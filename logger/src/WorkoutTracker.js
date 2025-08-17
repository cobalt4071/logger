import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress, // For timer progress bar
  Checkbox, // For set completion
  FormControlLabel, // For Checkbox label
  Accordion, // New import for dropdown
  AccordionSummary, // New import for dropdown
  AccordionDetails, // New import for dropdown
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // New import for dropdown
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear'; // Corrected import path
import NotesIcon from '@mui/icons-material/Notes';
import TimerIcon from '@mui/icons-material/Timer';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // Add this import

// Import Firebase modules for Firestore operations
import { collection, addDoc, query, onSnapshot, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";


// WorkoutTracker component
const WorkoutTracker = ({
  userId, appId, db, plannedWorkouts, showSnackbar,
  activeWorkoutSession, playbackBlocks, timerSecondsLeft, initialRestDuration, isTimerRunning,
  handleStartWorkoutSession, handleBlockCompletion, handlePauseResume, handleStopWorkout,
  advanceToNextActiveBlock,
  setActiveWorkoutSession, setPlaybackBlocks, setIsTimerRunning, setTimerSecondsLeft, setInitialRestDuration,
}) => {
  // State for the current workout being constructed or edited
  const [currentWorkoutName, setCurrentWorkoutName] = useState('');
  const [currentWorkoutBlocks, setCurrentWorkoutBlocks] = useState([]); // Array of { type, data }
  const [isWorkoutNameDialogOpen, setIsWorkoutNameDialogOpen] = useState(false);
  const [workoutNameInput, setWorkoutNameInput] = useState('');
  const [editingCreatedWorkoutId, setEditingCreatedWorkoutId] = useState(null);

  // States for adding new blocks (Note, Rest)
  const [noteText, setNoteText] = useState('');
  const [restDuration, setRestDuration] = useState('');
  const [selectedPlannedSetId, setSelectedPlannedSetId] = useState('');

  // States for controlling dialogs
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isRestDialogOpen, setIsRestDialogOpen] = useState(false);

  // Refs for drag and drop functionality
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // State to manage which view is shown: the list of workouts or the active playback
  const [view, setView] = useState('list');

  // State to store created workouts (fetched from Firestore)
  const [createdWorkouts, setCreatedWorkouts] = useState([]);

  // Add missing refs
  const timerIntervalRef = useRef(null);
  const activeBlockRef = useRef(null);

  // Add missing helper
  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Effect to switch to playback view when a workout becomes active,
  // and switch back to list view when it's stopped.
  useEffect(() => {
    if (activeWorkoutSession) {
      setView('playback');
    } else {
      setView('list');
    }
  }, [activeWorkoutSession]);
  
  
  // Effect to load created workouts from Firestore
  useEffect(() => {
    if (userId) {
      const createdWorkoutsRef = collection(db, `artifacts/${appId}/users/${userId}/recordedWorkouts`);
      // Order by creation date, most recent first
      const q = query(createdWorkoutsRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const workouts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCreatedWorkouts(workouts);
      }, (error) => {
        console.error('Error fetching created workouts from Firestore:', error);
        showSnackbar('Failed to load created workouts.', 'error');
      });

      // Cleanup subscription on unmount or userId change
      return () => unsubscribe();
    } else {
      setCreatedWorkouts([]); // Clear created workouts if no user
    }
  }, [userId, appId, db, showSnackbar]); // Added showSnackbar to dependencies

  // Function to open the workout name dialog (for new or editing name)
  const handleOpenWorkoutNameDialog = (workoutToEdit = null) => {
    if (workoutToEdit) {
      setWorkoutNameInput(workoutToEdit.name);
      setCurrentWorkoutName(workoutToEdit.name);
      setCurrentWorkoutBlocks(workoutToEdit.blocks || []);
      setEditingCreatedWorkoutId(workoutToEdit.id);
    } else {
      setWorkoutNameInput('');
      setCurrentWorkoutName('');
      setCurrentWorkoutBlocks([]);
      setEditingCreatedWorkoutId(null);
    }
    setIsWorkoutNameDialogOpen(true);
  };

  // Function to close the workout name dialog
  const handleCloseWorkoutNameDialog = () => {
    setIsWorkoutNameDialogOpen(false);
    setWorkoutNameInput('');
    setEditingCreatedWorkoutId(null);
    if (!currentWorkoutName && !editingCreatedWorkoutId) {
        setCurrentWorkoutBlocks([]);
    }
  };

  // Function to save workout name (for new or update existing name)
  const handleSaveWorkoutName = () => {
    if (!workoutNameInput.trim()) {
      showSnackbar('Workout name cannot be empty.', 'warning');
      return;
    }

    const nameExists = createdWorkouts.some(
        workout => workout.name.toLowerCase() === workoutNameInput.trim().toLowerCase() && workout.id !== editingCreatedWorkoutId
    );

    if (nameExists) {
        showSnackbar('A workout with this name already exists. Please choose a different name.', 'warning');
        return;
    }

    if (editingCreatedWorkoutId) {
      setCurrentWorkoutName(workoutNameInput.trim());
      showSnackbar(`Workout name updated to "${workoutNameInput.trim()}"!`, 'success');
    } else {
      setCurrentWorkoutName(workoutNameInput.trim());
      setCurrentWorkoutBlocks([]);
      showSnackbar(`Workout "${workoutNameInput.trim()}" started!`, 'success');
    }
    setIsWorkoutNameDialogOpen(false);
  };

  // Function to add a block (note, rest, planned set) to the current workout
  const addBlock = (type) => {
    if (!currentWorkoutName) {
      showSnackbar('Please name and start a workout first.', 'warning');
      return;
    }

    let newBlock;
    let message = '';

    switch (type) {
      case 'note':
        if (!noteText.trim()) {
          showSnackbar('Note cannot be empty.', 'warning');
          return;
        }
        newBlock = { type: 'note', text: noteText.trim() };
        setNoteText('');
        message = 'Note added.';
        setIsNoteDialogOpen(false);
        break;
      case 'rest':
        if (isNaN(parseInt(restDuration)) || parseInt(restDuration) <= 0) {
          showSnackbar('Rest time must be a positive number.', 'warning');
          return;
        }
        newBlock = { type: 'rest', duration: parseInt(restDuration) };
        setRestDuration('');
        message = 'Rest time added.';
        setIsRestDialogOpen(false);
        break;
      case 'plannedSet':
        const selectedSet = plannedWorkouts.find(set => set.id === selectedPlannedSetId);
        if (!selectedSet) {
          showSnackbar('Please select a planned set.', 'warning');
          return;
        }
        newBlock = {
          type: 'plannedSet',
          plannedSetDetails: { ...selectedSet },
        };
        setSelectedPlannedSetId('');
        message = `Planned set "${selectedSet.exercise}" added.`;
        break;
      default:
        return;
    }

    setCurrentWorkoutBlocks((prevBlocks) => [...prevBlocks, newBlock]);
    showSnackbar(message, 'success');
  };

  // Function to remove a block from the workout being constructed
  const removeBlock = (indexToRemove) => {
    setCurrentWorkoutBlocks((prevBlocks) =>
      prevBlocks.filter((_, index) => index !== indexToRemove)
    );
    showSnackbar('Block removed.', 'info');
  };

  // Function to save the entire constructed workout to Firestore (new or update)
  const saveWorkoutSession = async () => {
    if (!userId) {
      showSnackbar('Please sign in with Google to save your workout.', 'error');
      return;
    }
    if (!currentWorkoutName.trim()) {
      showSnackbar('Please name your workout before saving.', 'warning');
      return;
    }
    if (currentWorkoutBlocks.length === 0) {
      showSnackbar('Add some blocks to your workout before saving.', 'warning');
      return;
    }

    try {
      const workoutSessionData = {
        name: currentWorkoutName.trim(),
        blocks: currentWorkoutBlocks,
        userId: userId,
        date: new Date().toISOString(),
      };

      if (editingCreatedWorkoutId) {
        const workoutDocRef = doc(db, `artifacts/${appId}/users/${userId}/recordedWorkouts`, editingCreatedWorkoutId);
        await setDoc(workoutDocRef, workoutSessionData, { merge: true });
        showSnackbar('Workout session updated successfully!', 'success');
      } else {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/recordedWorkouts`), {
          ...workoutSessionData,
          createdAt: Date.now(),
        });
        showSnackbar('New workout session created successfully!', 'success');
      }

      setCurrentWorkoutName('');
      setCurrentWorkoutBlocks([]);
      setEditingCreatedWorkoutId(null);
    } catch (error) {
      console.error('Error saving workout session to Firestore:', error);
      showSnackbar(`Failed to save workout session: ${error.message}`, 'error');
    }
  };

  // Function to delete a created workout session
  const deleteCreatedWorkout = async (workoutIdToDelete) => {
    if (!userId) {
      showSnackbar('Please sign in to delete workouts.', 'error');
      return;
    }
    try {
      if (window.confirm('Are you sure you want to delete this workout session? This action cannot be undone.')) {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/recordedWorkouts`, workoutIdToDelete));
        showSnackbar('Workout session deleted.', 'info');
      }
    } catch (error) {
      console.error('Error deleting workout session from Firestore:', error);
      showSnackbar(`Failed to delete workout session: ${error.message}`, 'error');
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e, index) => {
    dragItem.current = index;
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnter = (e, index) => {
    dragOverItem.current = index;
    if (dragItem.current !== dragOverItem.current) {
      e.currentTarget.style.border = '2px dashed #90caf9';
    }
  };

  const handleDragLeave = (e) => {
    e.currentTarget.style.border = 'none';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.border = 'none';
    const allListItems = document.querySelectorAll('.draggable-workout-block');
    allListItems.forEach(item => {
      item.style.border = 'none';
      item.style.opacity = '1';
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const draggedIndex = dragItem.current;
    const droppedIndex = dragOverItem.current;

    if (draggedIndex === null || droppedIndex === null || draggedIndex === droppedIndex) {
      handleDragEnd(e);
      return;
    }

    const _currentWorkoutBlocks = [...currentWorkoutBlocks];
    const [reorderedItem] = _currentWorkoutBlocks.splice(draggedIndex, 1);
    _currentWorkoutBlocks.splice(droppedIndex, 0, reorderedItem);

    setCurrentWorkoutBlocks(_currentWorkoutBlocks);
    showSnackbar('Block reordered!', 'success');

    dragItem.current = null;
    dragOverItem.current = null;
    handleDragEnd(e);
  };
  // --- End Drag and Drop Handlers ---

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2, position: 'relative' }}>
      {view === 'playback' && activeWorkoutSession ? (
        // --- Workout Playback View (Displays all blocks as a list) ---
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton
              onClick={() => setView('list')}
              aria-label="back to workouts"
              sx={{ mr: 1, color: 'text.secondary' }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" sx={{ color: 'text.primary', flexGrow: 1 }}>
              {activeWorkoutSession.name}
            </Typography>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Date: {formatDate(activeWorkoutSession.date)}
          </Typography>

          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

          {playbackBlocks.length > 0 ? (
            <List sx={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', pr: 1 }}>
              {playbackBlocks.map((block, index) => (
                <Paper
                  key={index}
                  elevation={block.status === 'active' ? 5 : 1}
                  sx={{
                    mb: 1,
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor:
                      block.status === 'active'
                        ? 'background.paper'
                        : 'background.paper',
                    opacity: block.status === 'completed' ? 0.6 : 1,
                    border: block.status === 'active' ? '2px solid' : 'none',
                    borderColor: block.status === 'active' ? 'primary.main' : 'transparent',
                    minHeight: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                  ref={block.status === 'active' ? activeBlockRef : null}
                >
                  {block.type === 'plannedSetInstance' && (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                        <ListItemIcon sx={{ minWidth: '40px' }}>
                          <FitnessCenterIcon fontSize="medium" color="success" />
                        </ListItemIcon>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {block.exercise} - Set {block.currentSetNum} of {block.totalSets}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {block.reps} reps @ {block.weight}kg
                          </Typography>
                        </Box>
                      </Box>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={block.status === 'completed'}
                            onChange={() => handleBlockCompletion(index)}
                            disabled={block.status !== 'active'}
                            color="success"
                            sx={{
                              width: 36,
                              height: 36,
                              '& .MuiSvgIcon-root': { fontSize: 36 },
                            }}
                          />
                        }
                        label=""
                        sx={{ ml: 1 }}
                      />
                    </>
                  )}

                  {block.type === 'note' && (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                        <ListItemIcon sx={{ minWidth: '40px' }}>
                          <NotesIcon fontSize="medium" color="info" />
                        </ListItemIcon>
                        <Box>
                          <Typography variant="body1" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                            Note:
                          </Typography>
                          <Typography variant="body2">{block.text}</Typography>
                        </Box>
                      </Box>
                    </>
                  )}

                  {block.type === 'rest' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <ListItemIcon sx={{ minWidth: '40px' }}>
                        <TimerIcon fontSize="medium" color={block.originatingPlannedSet ? 'warning' : 'info'} />
                      </ListItemIcon>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ color: block.originatingPlannedSet ? 'warning.main' : 'info.main', fontWeight: 'bold' }}>
                          Rest Time
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {block.originatingPlannedSet ?
                            `After ${block.originatingPlannedSet} Set ${block.originatingSetNum}`
                            : 'General rest period'
                          }
                        </Typography>
                      </Box>
                      {/* Conditional rendering of timer and skip button based on active status */}
                      {block.status === 'active' ? (
                        <Box sx={{ textAlign: 'right', ml: 2, position: 'relative' }}>
                          <Typography variant="h5" sx={{ color: block.originatingPlannedSet ? 'warning.main' : 'info.main', fontWeight: 'bold' }}>
                            {timerSecondsLeft}s
                          </Typography>
                          {initialRestDuration > 0 && (
                            <LinearProgress
                              variant="determinate"
                              value={((initialRestDuration - timerSecondsLeft) / initialRestDuration) * 100}
                              color={block.originatingPlannedSet ? 'warning' : 'info'}
                              sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                            />
                          )}
                          <Button
                            variant="outlined"
                            color="secondary"
                            size="small"
                            onClick={() => {
                                // App.js handles all timer state logic when advancing.
                                // Just need to call the advance function.
                                advanceToNextActiveBlock();
                            }}
                            sx={{ borderRadius: '8px', ml: 2, mt: 1 }}
                          >
                            Skip
                          </Button>
                        </Box>
                      ) : (
                        // Display static rest duration for non-active rest blocks
                        <Typography variant="h5" sx={{ color: block.originatingPlannedSet ? 'warning.main' : 'info.main', fontWeight: 'bold', ml: 2 }}>
                          {block.duration}s
                        </Typography>
                      )}
                    </Box>
                  )}
                </Paper>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
              This workout has no blocks to play.
            </Typography>
          )}

          {/* Playback Controls */}
          <Box sx={{ mt: 3, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant={isTimerRunning ? "outlined" : "contained"}
              color="warning"
              onClick={handlePauseResume}
              sx={{ borderRadius: '8px', px: 4, py: 1.5 }}
              disabled={initialRestDuration === 0}
            >
              {isTimerRunning ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleStopWorkout}
              sx={{ borderRadius: '8px', px: 4, py: 1.5 }}
            >
              Stop
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setView('list')}
              startIcon={<ArrowBackIcon />}
              sx={{ borderRadius: '8px', px: 4, py: 1.5 }}
            >
              Back to Workouts
            </Button>
          </Box>
        </Box>

      ) : (
        // --- Workout Construction and Created Workouts List View (Existing UI) ---
        <>
          {/* Main heading for "Planned Workouts" section with "Create New Workout" button */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'text.primary' }}>
              Planned Workouts
            </Typography>
            <IconButton
              color="primary"
              onClick={() => handleOpenWorkoutNameDialog(null)}
              aria-label="create new workout"
              disabled={!userId}
              sx={{
                borderRadius: '6px',
                backgroundColor: 'primary.main',
                padding: '6px',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              }}
            >
              <AddIcon fontSize="medium" sx={{ color: 'background.paper' }}/>
            </IconButton>
          </Box>

          {/* Conditional display for the workout construction area */}
          {currentWorkoutName ? (
            <>
              <Typography variant="subtitle1" sx={{ color: 'text.primary', mb: 1 }}>
                Current Workout: <strong>{currentWorkoutName}</strong>
                {editingCreatedWorkoutId && (
                  <IconButton
                    size="small"
                    onClick={() => handleOpenWorkoutNameDialog({ id: editingCreatedWorkoutId, name: currentWorkoutName, blocks: currentWorkoutBlocks })}
                    sx={{ ml: 1, color: 'text.secondary' }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                    setCurrentWorkoutName('');
                    setCurrentWorkoutBlocks([]);
                    setEditingCreatedWorkoutId(null);
                    showSnackbar('Current workout cleared.', 'info');
                }}
                sx={{ borderRadius: '8px', mb: 3 }}
              >
                Clear Current Workout
              </Button>

              <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

              <Typography variant="subtitle1" sx={{ color: 'text.primary', mb: 1 }}>
                Add Blocks to This Workout
              </Typography>

              {/* Buttons for Note and Rest */}
              <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<NotesIcon />}
                  onClick={() => setIsNoteDialogOpen(true)}
                  disabled={!currentWorkoutName}
                  sx={{ borderRadius: '8px', flexGrow: 1 }}
                >
                  Add Note
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<TimerIcon />}
                  onClick={() => setIsRestDialogOpen(true)}
                  disabled={!currentWorkoutName}
                  sx={{ borderRadius: '8px', flexGrow: 1 }}
                >
                  Add Rest
                </Button>
              </Box>

              {/* Add Planned Set */}
              <Box sx={{ display: 'flex', gap: 1, mb: 3, alignItems: 'center' }}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Select Planned Set</InputLabel>
                  <Select
                    value={selectedPlannedSetId}
                    onChange={(e) => setSelectedPlannedSetId(e.target.value)}
                    label="Select Planned Set"
                    disabled={!currentWorkoutName || plannedWorkouts.length === 0}
                  >
                    {plannedWorkouts.length === 0 ? (
                      <MenuItem disabled>No planned sets available</MenuItem>
                    ) : (
                      plannedWorkouts.map((set) => (
                        <MenuItem key={set.id} value={set.id}>
                          {set.exercise} - {set.sets}x{set.reps} @ {set.weight}kg
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => addBlock('plannedSet')}
                  disabled={!selectedPlannedSetId || !currentWorkoutName}
                  sx={{
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    minWidth: '36px',
                    minHeight: '36px',
                    padding: '0',
                  }}
                >
                  <AddIcon fontSize="medium" sx={{ color: 'background.paper' }}/>
                </Button>
              </Box>

              <Typography variant="subtitle1" sx={{ color: 'text.primary', mb: 1 }}>
                Workout Structure
              </Typography>
              {currentWorkoutBlocks.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Add blocks above to build your workout session.
                </Typography>
              ) : (
                <List>
                  {currentWorkoutBlocks.map((block, index) => (
                    <Paper
                      key={index}
                      elevation={1}
                      sx={{
                        mb: 1,
                        borderRadius: '8px',
                        bgcolor: 'background.paper',
                        cursor: 'grab',
                        '&:active': {
                          cursor: 'grabbing',
                        },
                      }}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragLeave={(e) => handleDragLeave(e)}
                      onDrop={(e) => handleDrop(e)}
                      onDragEnd={(e) => handleDragEnd(e)}
                      className="draggable-workout-block"
                    >
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" aria-label="remove" onClick={() => removeBlock(index)}>
                            <ClearIcon sx={{ color: 'text.secondary' }} />
                          </IconButton>
                        }
                      >
                        {/* Drag handle icon */}
                        <ListItemIcon sx={{ minWidth: '32px', cursor: 'grab' }}>
                            <DragIndicatorIcon sx={{ color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemIcon sx={{ minWidth: '32px' }}>
                          {block.type === 'note' && <NotesIcon color="info" />}
                          {block.type === 'rest' && <TimerIcon color="warning" />}
                          {block.type === 'plannedSet' && <FitnessCenterIcon color="success" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            block.type === 'note'
                              ? `Note: ${block.text}`
                              : block.type === 'rest'
                              ? `Rest: ${block.duration} seconds`
                              : `${block.plannedSetDetails.exercise} - ${block.plannedSetDetails.sets} sets x ${block.plannedSetDetails.reps} reps @ ${block.plannedSetDetails.weight}kg`
                          }
                          sx={{ my: 0 }}
                        />
                      </ListItem>
                    </Paper>
                  ))}
                </List>
              )}

              {/* Save Workout Button */}
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={saveWorkoutSession}
                  disabled={currentWorkoutBlocks.length === 0 || !userId}
                  sx={{ borderRadius: '8px', px: 4, py: 1.5 }}
                >
                  {editingCreatedWorkoutId ? 'Update Workout Session' : 'Save Workout Session'}
                </Button>
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mt: 2, mb: 3 }}>
              {userId ? 'Use the \'+\' button above to create your first workout session!' : 'Sign in to create and manage your workout sessions.'}
            </Typography>
          )}

          {/* Dialog for Naming New Workout or Editing Name */}
          <Dialog open={isWorkoutNameDialogOpen} onClose={handleCloseWorkoutNameDialog}>
            <DialogTitle>
              {editingCreatedWorkoutId ? 'Edit Workout Name' : 'Name Your Workout'}
            </DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Workout Name"
                type="text"
                fullWidth
                variant="outlined"
                value={workoutNameInput}
                onChange={(e) => setWorkoutNameInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveWorkoutName();
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleCloseWorkoutNameDialog()} color="secondary">
                Cancel
              </Button>
              <Button onClick={handleSaveWorkoutName} color="primary" disabled={!workoutNameInput.trim()}>
                {editingCreatedWorkoutId ? 'Save Name' : 'Create Workout'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={isNoteDialogOpen} onClose={() => setIsNoteDialogOpen(false)}>
            <DialogTitle>Add a Note</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Note Text"
                type="text"
                fullWidth
                variant="outlined"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addBlock('note');
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsNoteDialogOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={() => addBlock('note')} color="primary" disabled={!noteText.trim()}>
                Add Note
              </Button>
            </DialogActions>
          </Dialog>
          
          <Dialog open={isRestDialogOpen} onClose={() => setIsRestDialogOpen(false)}>
            <DialogTitle>Add a Rest Period</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Rest Time (seconds)"
                type="number"
                fullWidth
                variant="outlined"
                value={restDuration}
                onChange={(e) => setRestDuration(e.target.value)}
                inputProps={{ min: 1 }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addBlock('rest');
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsRestDialogOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={() => addBlock('rest')} color="primary" disabled={isNaN(parseInt(restDuration)) || parseInt(restDuration) <= 0}>
                Add Rest
              </Button>
            </DialogActions>
          </Dialog>

          {/* New "Created Workouts" list using Accordion */}
          <Box sx={{ mt: 4, mb: 2, p: 1, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {createdWorkouts.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ px: 2, py: 1 }}>
                    {userId ? 'No created workouts found.' : 'Sign in to see your created workouts.'}
                </Typography>
            ) : (
                createdWorkouts.map((workout) => (
                    <Accordion key={workout.id} sx={{ bgcolor: 'background.paper', my: 1, '&:before': { display: 'none' } }}>
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                            aria-controls={`panel-${workout.id}-content`}
                            id={`panel-${workout.id}-header`}
                            sx={{
                                '& .MuiAccordionSummary-content': {
                                    my: 0.5,
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                },
                            }}
                        >
                            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    {workout.name}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                                    {formatDate(workout.date)}
                                </Typography>
                                {activeWorkoutSession && activeWorkoutSession.id === workout.id && (
                                    <Typography variant="body2" sx={{ ml: 2, color: 'success.main', fontWeight: 'bold' }}>
                                        Active Session
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                                <IconButton
                                    aria-label="play"
                                    color="success"
                                    onClick={(e) => { e.stopPropagation(); handleStartWorkoutSession(workout); }}
                                    size="small"
                                >
                                    <PlayArrowIcon />
                                </IconButton>
                                <IconButton
                                    aria-label="edit"
                                    color="primary"
                                    onClick={(e) => { e.stopPropagation(); handleOpenWorkoutNameDialog(workout); }}
                                    size="small"
                                >
                                    <EditIcon />
                                </IconButton>
                                <IconButton
                                    aria-label="delete"
                                    color="error"
                                    onClick={(e) => { e.stopPropagation(); deleteCreatedWorkout(workout.id); }}
                                    size="small"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                            {workout.blocks.map((block, blockIndex) => (
                                <Typography key={blockIndex} variant="body2" color="textSecondary" sx={{ ml: 1, my: 0.5 }}>
                                    - {block.type === 'plannedSet'
                                        ? `${block.plannedSetDetails.exercise}: ${block.plannedSetDetails.sets}x${block.plannedSetDetails.reps}`
                                        : block.type === 'rest'
                                        ? `Rest: ${block.duration}s`
                                        : `Note: "${block.text}"`
                                    }
                                </Typography>
                            ))}
                        </AccordionDetails>
                    </Accordion>
                ))
            )}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default WorkoutTracker;