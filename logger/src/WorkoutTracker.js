import React, { useState, useEffect, useRef } from 'react';
import {
  Typography,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
  Modal,
  TextField,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import DeleteIcon from '@mui/icons-material/Delete';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import { addDoc, collection } from 'firebase/firestore';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  borderRadius: '12px',
  boxShadow: 24,
  p: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

// Helper function to format seconds into MM:SS
const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const WorkoutTracker = ({
  userId,
  appId,
  db,
  plannedWorkouts,
  showSnackbar,
  activeWorkoutSession,
  playbackBlocks,
  timerSecondsLeft,
  initialRestDuration,
  isTimerRunning,
  handleStartWorkoutSession,
  handleBlockCompletion,
  handlePauseResume,
  handleStopWorkout,
  advanceToNextActiveBlock,
  setActiveWorkoutSession,
  setPlaybackBlocks,
  setIsTimerRunning,
  setTimerSecondsLeft,
  setInitialRestDuration,
}) => {
  const [workoutName, setWorkoutName] = useState('');
  const [sessionWorkouts, setSessionWorkouts] = useState([]);
  const [isWorkoutBuilderOpen, setIsWorkoutBuilderOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  const timerIntervalRef = useRef(null);

  useEffect(() => {
    if (isTimerRunning && timerSecondsLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerSecondsLeft === 0 && isTimerRunning) {
      clearInterval(timerIntervalRef.current);
      setIsTimerRunning(false);
      advanceToNextActiveBlock();
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning, timerSecondsLeft, setTimerSecondsLeft, setIsTimerRunning, advanceToNextActiveBlock]);


  const handleOpenWorkoutBuilder = () => {
    setWorkoutName('');
    setSessionWorkouts([]);
    setIsWorkoutBuilderOpen(true);
  };

  const handleCloseWorkoutBuilder = () => {
    setIsWorkoutBuilderOpen(false);
  };

  const handleAddPlannedSet = (plannedSet) => {
    setSessionWorkouts((prev) => [...prev, {
      type: 'plannedSet',
      plannedSetDetails: plannedSet,
    }]);
  };

  const handleAddNote = () => {
    if (newNoteText.trim() === '') {
      showSnackbar('Note cannot be empty!', 'warning');
      return;
    }
    setSessionWorkouts((prev) => [...prev, {
      type: 'note',
      noteText: newNoteText,
    }]);
    setNewNoteText('');
    setIsAddNoteModalOpen(false);
  };

  const handleDeleteBlock = (index) => {
    setSessionWorkouts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveWorkoutTemplate = async () => {
    if (!userId) {
      showSnackbar('Please sign in to save a workout template.', 'error');
      return;
    }
    if (workoutName.trim() === '') {
      showSnackbar('Workout name is required!', 'warning');
      return;
    }
    if (sessionWorkouts.length === 0) {
      showSnackbar('Add at least one set or note to save.', 'warning');
      return;
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/workoutTemplates`), {
        name: workoutName,
        blocks: sessionWorkouts,
        createdAt: Date.now(),
      });
      showSnackbar('Workout template saved successfully!', 'success');
      handleCloseWorkoutBuilder();
    } catch (error) {
      console.error('Error saving workout template:', error);
      showSnackbar('Failed to save workout template.', 'error');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <FlagIcon sx={{ color: 'success.main', mr: 1 }} />;
      case 'active': return <PlayArrowIcon sx={{ color: 'warning.main', mr: 1 }} />;
      default: return <AccessTimeIcon sx={{ color: 'text.secondary', mr: 1 }} />;
    }
  };

  const renderPlaybackBlock = (block, index) => {
    const isRestBlock = block.type === 'rest';
    const isActive = block.status === 'active';
    const isCompleted = block.status === 'completed';

    const renderText = () => {
      if (block.type === 'plannedSetInstance') {
        return `${block.exercise}: Set ${block.currentSetNum} of ${block.totalSets} (${block.reps} reps @ ${block.weight} kg)`;
      } else if (isRestBlock) {
        return `Rest: ${block.duration} seconds`;
      } else if (block.type === 'note') {
        return `Note: ${block.noteText}`;
      }
      return '';
    };

    return (
      <ListItem
        key={index}
        sx={{
          bgcolor: isActive ? 'warning.light' : isCompleted ? 'success.dark' : 'background.default',
          my: 1,
          borderRadius: 2,
          border: isActive ? '2px solid' : '1px solid',
          borderColor: isActive ? 'warning.main' : isCompleted ? 'success.dark' : 'divider',
          boxShadow: isActive ? 5 : 1,
          transition: 'all 0.3s',
        }}
      >
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
              {getStatusIcon(block.status)}
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {renderText()}
              </Typography>
            </Box>
          }
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isRestBlock && !isCompleted && isActive && (
            <Button
              variant="contained"
              color="success"
              onClick={() => handleBlockCompletion(index)}
              size="small"
              sx={{ minWidth: 'auto' }}
            >
              Complete
            </Button>
          )}
          {isRestBlock && isActive && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => advanceToNextActiveBlock()}
              size="small"
              sx={{ minWidth: 'auto' }}
            >
              <SkipNextIcon sx={{ mr: 1 }} />
              Skip
            </Button>
          )}
        </Box>
      </ListItem>
    );
  };
  
  return (
    <Box>
      {activeWorkoutSession ? (
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'text.primary' }}>
              Current Workout: {activeWorkoutSession.name}
            </Typography>
            <Box>
              <IconButton onClick={handlePauseResume} size="large" color="inherit">
                {isTimerRunning ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
              <IconButton onClick={handleStopWorkout} size="large" color="inherit">
                <StopIcon />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
              {isTimerRunning ? formatTime(timerSecondsLeft) : '00:00'}
            </Typography>
            {isTimerRunning && initialRestDuration > 0 && (
              <Typography variant="body1" color="text.secondary">
                Rest Period
              </Typography>
            )}
          </Box>
          <Divider sx={{ my: 2 }} />
          <List>
            {playbackBlocks.map((block, index) => renderPlaybackBlock(block, index))}
          </List>
        </Paper>
      ) : (
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Create a New Workout</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenWorkoutBuilder}
              disabled={!userId}
              startIcon={<AddIcon />}
              sx={{ p: 2, minWidth: '200px' }}
            >
              Build Workout
            </Button>
          </Box>
        </Paper>
      )}

      <Modal open={isWorkoutBuilderOpen} onClose={handleCloseWorkoutBuilder}>
        <Paper sx={{ ...style, width: { xs: '90%', md: '600px' }, maxHeight: '80vh', overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
              Workout Builder
            </Typography>
            <Box>
              <IconButton onClick={() => setIsAddNoteModalOpen(true)} color="secondary" size="small">
                <NoteAddIcon />
              </IconButton>
              <IconButton onClick={handleSaveWorkoutTemplate} color="primary" size="small" disabled={sessionWorkouts.length === 0 || workoutName.trim() === ''}>
                <SaveIcon />
              </IconButton>
            </Box>
          </Box>

          <TextField
            label="Workout Name"
            variant="outlined"
            fullWidth
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Sets in this Workout:
            </Typography>
            <Button onClick={handleStartWorkoutSession} disabled={sessionWorkouts.length === 0}>Start Workout</Button>
          </Box>
          
          <List sx={{ width: '100%', bgcolor: 'background.paper', mb: 2, p: 0 }}>
            {sessionWorkouts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                Add sets or notes from the list below.
              </Typography>
            ) : (
              sessionWorkouts.map((block, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteBlock(index)}>
                      <DeleteIcon color="error" />
                    </IconButton>
                  }
                  sx={{ my: 1, p: 2, borderRadius: 2, bgcolor: 'background.default' }}
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ fontWeight: 'bold' }}>
                        {block.type === 'plannedSet'
                          ? block.plannedSetDetails.exercise
                          : 'Note'
                        }
                      </Typography>
                    }
                    secondary={
                      block.type === 'plannedSet'
                        ? `${block.plannedSetDetails.sets}x${block.plannedSetDetails.reps} @ ${block.plannedSetDetails.weight} kg, Rest: ${block.plannedSetDetails.restTime}s`
                        : block.noteText
                    }
                  />
                </ListItem>
              ))
            )}
          </List>

          <Divider sx={{ my: 2 }}>Add from Planned Sets</Divider>

          <List sx={{ width: '100%', maxHeight: '30vh', overflowY: 'auto', bgcolor: 'background.default', borderRadius: 2 }}>
            {plannedWorkouts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 2 }}>
                No planned sets found. Go to the "Sets" tab to create some!
              </Typography>
            ) : (
              plannedWorkouts.map((workout) => (
                <ListItem
                  key={workout.id}
                  secondaryAction={
                    <IconButton edge="end" aria-label="add" onClick={() => handleAddPlannedSet(workout)}>
                      <AddIcon color="primary" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={workout.exercise}
                    secondary={`${workout.sets}x${workout.reps} @ ${workout.weight} kg, Rest: ${workout.restTime}s`}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Paper>
      </Modal>

      <Modal open={isAddNoteModalOpen} onClose={() => setIsAddNoteModalOpen(false)}>
        <Paper sx={{ ...style, width: { xs: '90%', sm: '400px' } }}>
          <Typography variant="h6" component="h2">Add a Note</Typography>
          <TextField
            label="Note Text"
            multiline
            rows={4}
            fullWidth
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
          />
          <Button variant="contained" color="primary" onClick={handleAddNote} startIcon={<SaveIcon />}>
            Save Note
          </Button>
        </Paper>
      </Modal>
    </Box>
  );
};

export default WorkoutTracker;