import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Snackbar,
  Alert,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import TimerIcon from '@mui/icons-material/Timer';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import CheckIcon from '@mui/icons-material/Check';

// Import Firebase modules
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Import the new WorkoutTracker component
import WorkoutTracker from './WorkoutTracker';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global variables for Canvas environment - MANDATORY to use
const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';

// Define the dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1d1d1d',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#bdbdbd',
    },
  },
  typography: {
    fontFamily: 'JetBrains Mono, monospace',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
          },
          '& .MuiInputLabel-root': {
            color: '#bdbdbd',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: '12px',
          backgroundColor: '#2b2b2b',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#444444',
          color: '#e0e0e0',
          padding: '8px 16px',
        },
      },
    },
  },
});

// Main App component for creating and listing workout sets
const App = () => {
  const [plannedWorkouts, setPlannedWorkouts] = useState([]);
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [restTime, setRestTime] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentTab, setCurrentTab] = useState('sets');
  const [isFinishConfirmDialogOpen, setIsFinishConfirmDialogOpen] = useState(false);

  // --- Snackbar State and Function (Now only defined once) ---
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const showSnackbar = useCallback((message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);
  // --- End Snackbar State and Function ---

  // --- Workout Playback Persistent State using Firestore ---
  const [activeWorkoutSession, setActiveWorkoutSession] = useState(null);
  const [activeSessionStartTime, setActiveSessionStartTime] = useState(null);
  const [playbackBlocks, setPlaybackBlocks] = useState([]);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [initialRestDuration, setInitialRestDuration] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef(null);
  const elapsedTimerIntervalRef = useRef(null);
  const sessionDocRef = useRef(null);

  // Helper function to format seconds into MM:SS
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
  };
  
  // --- Stop Workout Handler ---
  const handleStopWorkout = useCallback(async () => {
    if (!userId) return;
    // The onSnapshot listener will handle cleaning up state and timers reactively.
    await setDoc(sessionDocRef.current, { active: false }, { merge: true });
    showSnackbar('Workout stopped.', 'info');
  }, [userId, showSnackbar]);

  // --- Finish and Save Workout Handler ---
  const handleFinishWorkoutAndSave = async () => {
    if (!userId || !activeWorkoutSession) {
      showSnackbar('No active workout to finish or user not signed in.', 'warning');
      return;
    }

    const completedBlocks = playbackBlocks
      .filter(block => block.status === 'completed')
      .map(block => {
        if (block.type === 'plannedSetInstance') {
          return {
            type: 'plannedSetInstance',
            exercise: block.exercise,
            weight: block.weight,
            reps: block.reps,
          };
        }
        if (block.type === 'rest') {
          return {
            type: 'rest',
            duration: block.duration,
            actualDuration: block.actualDuration,
          };
        }
        if (block.type === 'note') {
            return {
                type: 'note',
                text: block.text,
            };
        }
        return null;
      }).filter(Boolean);

    if (completedBlocks.length > 0) {
      try {
        const sessionData = {
          name: activeWorkoutSession.name,
          date: new Date().toISOString(),
          userId: userId,
          blocks: completedBlocks,
        };

        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/sessionHistory`), sessionData);
        showSnackbar(`Workout session with ${completedBlocks.length} completed blocks saved to history!`, 'success');
      } catch (error) {
        console.error('Error saving session history to Firestore:', error);
        showSnackbar(`Failed to save session history: ${error.message}`, 'error');
      }
    } else {
        showSnackbar('No completed blocks to save.', 'info');
    }

    // Now, stop the workout
    handleStopWorkout();
    setIsFinishConfirmDialogOpen(false);
  };

  // --- Advance Block Handler ---
  const advanceToNextActiveBlock = useCallback(async () => {
    const docSnap = await getDoc(sessionDocRef.current);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const currentBlocks = data.playbackBlocks;
    const currentTimerSecondsLeft = data.timerSecondsLeft;
    const currentInitialRestDuration = data.initialRestDuration;

    const findActiveBlockIndex = currentBlocks.findIndex(block => block.status === 'active');
    if (findActiveBlockIndex === -1) return;

    const newPlaybackBlocks = [...currentBlocks];
    const activeBlock = newPlaybackBlocks[findActiveBlockIndex];

    if (activeBlock.type === 'rest') {
      activeBlock.actualDuration = currentInitialRestDuration - currentTimerSecondsLeft;
    }

    newPlaybackBlocks[findActiveBlockIndex].status = 'completed';

    const nextPendingNonNoteIndex = newPlaybackBlocks.findIndex((block, index) =>
      index > findActiveBlockIndex && block.status === 'pending' && block.type !== 'note'
    );

    if (nextPendingNonNoteIndex !== -1) {
      for (let i = findActiveBlockIndex + 1; i < nextPendingNonNoteIndex; i++) {
        if (newPlaybackBlocks[i].type === 'note') {
          newPlaybackBlocks[i].status = 'completed';
          showSnackbar('Note skipped.', 'info');
        }
      }
    }

    if (nextPendingNonNoteIndex !== -1) {
      newPlaybackBlocks[nextPendingNonNoteIndex].status = 'active';
      const nextBlock = newPlaybackBlocks[nextPendingNonNoteIndex];
      const updateData = { playbackBlocks: newPlaybackBlocks };

      if (nextBlock.type === 'rest') {
        updateData.timerSecondsLeft = nextBlock.duration;
        updateData.initialRestDuration = nextBlock.duration;
        updateData.isTimerRunning = true;
      } else {
        updateData.isTimerRunning = false;
        updateData.timerSecondsLeft = 0;
        updateData.initialRestDuration = 0;
      }
      await setDoc(sessionDocRef.current, updateData, { merge: true });
    } else {
      showSnackbar('Workout Complete! Great job!', 'success');
      setIsFinishConfirmDialogOpen(true);
    }
  }, [showSnackbar, setIsFinishConfirmDialogOpen]);
  
  // 1. Firebase Authentication Setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
        console.log("Auth state changed. User ID:", user.uid);
      } else {
        setUserId(null);
        setIsAuthReady(true);
        console.log("Auth state changed. No user signed in.");
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Load planned workouts and set up listener for active session
  useEffect(() => {
    if (isAuthReady && userId) {
      // Setup Firestore reference for the active session
      sessionDocRef.current = doc(db, `artifacts/${appId}/users/${userId}/activeSession/state`);

      // Set up real-time listener for the active session state
      const unsubscribeSession = onSnapshot(sessionDocRef.current, (docSnap) => {
        if (docSnap.exists() && docSnap.data().active) {
          const data = docSnap.data();
          setActiveWorkoutSession(data.activeWorkoutSession);
          setActiveSessionStartTime(data.startTime || null);
          setPlaybackBlocks(data.playbackBlocks || []);
          setTimerSecondsLeft(data.timerSecondsLeft || 0);
          setInitialRestDuration(data.initialRestDuration || 0);
          setIsTimerRunning(data.isTimerRunning || false);
        } else {
          setActiveWorkoutSession(null);
          setActiveSessionStartTime(null);
          setPlaybackBlocks([]);
          setTimerSecondsLeft(0);
          setInitialRestDuration(0);
          setIsTimerRunning(false);
        }
      }, (error) => {
        console.error('Error fetching active workout session from Firestore:', error);
      });

      // Load planned workouts
      const workoutCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`);
      const q = query(workoutCollectionRef);

      const unsubscribeWorkouts = onSnapshot(q, (snapshot) => {
        const workouts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPlannedWorkouts(workouts);
        showSnackbar('Workout plan loaded from cloud!', 'success');
      }, (error) => {
        console.error('Error fetching planned workouts from Firestore:', error);
        showSnackbar('Failed to load workout plan from cloud.', 'error');
      });

      // Cleanup subscriptions on unmount or user change
      return () => {
        unsubscribeSession();
        unsubscribeWorkouts();
      };
    } else if (isAuthReady && !userId) {
      setPlannedWorkouts([]);
    }
  }, [isAuthReady, userId, showSnackbar]);

  // Effect to manage the rest timer countdown
  useEffect(() => {
    if (isTimerRunning && timerSecondsLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft(prevTime => (prevTime > 0 ? prevTime - 1 : 0));
      }, 1000);
    } else if (timerSecondsLeft === 0 && isTimerRunning) {
      clearInterval(timerIntervalRef.current);
      advanceToNextActiveBlock();
    }
    // Cleanup function to clear the interval
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning, timerSecondsLeft, advanceToNextActiveBlock]);

  // Effect to manage elapsed time display
  useEffect(() => {
    if (activeSessionStartTime) {
      elapsedTimerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeSessionStartTime) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(elapsedTimerIntervalRef.current);
  }, [activeSessionStartTime]);

  // Function to handle Google Sign-In
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showSnackbar('Successfully signed in with Google!', 'success');
    } catch (error) {
      console.error("Error during Google Sign-In:", error.message);
      showSnackbar(`Google Sign-In failed: ${error.message}`, 'error');
    }
  };

  // Function to handle Sign-Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showSnackbar('Successfully signed out.', 'info');
    } catch (error) {
      console.error("Error during sign-out:", error.message);
      showSnackbar(`Sign-out failed: ${error.message}`, 'error');
    }
  };

  // Function to close Snackbar
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Functions to open and close the modal (these are still for planned sets)
  const handleOpenForm = (workoutToEdit = null) => {
    if (workoutToEdit) {
      setExercise(workoutToEdit.exercise);
      setSets(workoutToEdit.sets);
      setReps(workoutToEdit.reps);
      setWeight(workoutToEdit.weight);
      setRestTime(workoutToEdit.restTime);
      setEditingWorkoutId(workoutToEdit.id);
    } else {
      setExercise('');
      setSets('');
      setReps('');
      setWeight('');
      setRestTime('');
      setEditingWorkoutId(null);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setExercise('');
    setSets('');
    setReps('');
    setWeight('');
    setRestTime('');
    setEditingWorkoutId(null);
  };

  // Function to add a new planned workout entry or update an existing one in Firestore
  const handleSaveWorkout = async () => {
    if (!userId) {
      showSnackbar('Please sign in with Google to save your workout.', 'error');
      return;
    }

    if (!exercise.trim()) {
      showSnackbar('Exercise name cannot be empty.', 'warning');
      return;
    }
    if (isNaN(parseInt(sets)) || parseInt(sets) <= 0) {
      showSnackbar('Sets must be a positive number.', 'warning');
      return;
    }
    if (isNaN(parseInt(reps)) || parseInt(reps) <= 0) {
      showSnackbar('Reps must be a positive number.', 'warning');
      return;
    }
    if (isNaN(parseFloat(weight)) || parseFloat(weight) < 0) {
      showSnackbar('Weight must be a non-negative number.', 'warning');
      return;
    }
    if (isNaN(parseInt(restTime)) || parseInt(restTime) < 0) {
      showSnackbar('Rest time must be a non-negative number.', 'warning');
      return;
    }

    const nameExists = plannedWorkouts.some(
      workout => workout.exercise.toLowerCase() === exercise.trim().toLowerCase() && workout.id !== editingWorkoutId
    );

    if (nameExists) {
      showSnackbar('A planned set with this exercise name already exists. Please choose a different name.', 'warning');
      return;
    }

    const workoutData = {
      exercise: exercise.trim(),
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight: parseFloat(weight),
      restTime: parseInt(restTime),
      userId: userId,
      createdAt: Date.now(),
    };

    try {
      if (editingWorkoutId) {
        const workoutDocRef = doc(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`, editingWorkoutId);
        await setDoc(workoutDocRef, workoutData, { merge: true });
        showSnackbar('Workout plan updated in cloud!', 'success');
      } else {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`), workoutData);
        showSnackbar('Workout set planned and saved to cloud!', 'success');
      }
    } catch (error) {
      console.error('Error saving workout to Firestore:', error);
      showSnackbar(`Failed to save workout: ${error.message}`, 'error');
    }

    setExercise('');
    setSets('');
    setReps('');
    setWeight('');
    setRestTime('');
    setEditingWorkoutId(null);
    handleCloseForm();
  };

  // Function to delete a planned workout entry from Firestore
  const deletePlannedWorkout = async (idToDelete) => {
    if (!userId) {
      showSnackbar('Please sign in with Google to delete workouts.', 'error');
      return;
    }
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`, idToDelete));
      showSnackbar('Planned workout deleted from cloud.', 'info');
    } catch (error) {
      console.error('Error deleting workout from Firestore:', error);
      showSnackbar(`Failed to delete workout: ${error.message}`, 'error');
    }
  };

  // Filtered workouts based on search query
  const filteredWorkouts = plannedWorkouts.filter(workout =>
    workout.exercise.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };
  
  // --- Block Completion Handler ---
  const handleBlockCompletion = async (index) => {
    const docSnap = await getDoc(sessionDocRef.current);
    if (!docSnap.exists()) return;

    const currentBlocks = docSnap.data().playbackBlocks;
    const blockToComplete = currentBlocks[index];
    // We only want to advance if the user clicks the currently active block.
    if (blockToComplete.status !== 'active') {
      return; // The checkbox should be disabled anyway, but this is a safeguard.
    }
    // advanceToNextActiveBlock will find the active block, mark it complete,
    // and move to the next one, starting timers if needed.
    await advanceToNextActiveBlock();
  };

  // --- Start Workout Handler ---
  const handleStartWorkoutSession = async (workout) => {
    if (!userId) {
      showSnackbar('Please sign in to start a workout.', 'warning');
      return;
    }
  
    // Check if a workout is already active to prevent starting a new one
    const docSnap = await getDoc(sessionDocRef.current);
    if (docSnap.exists() && docSnap.data().active) {
      showSnackbar('A workout is already in progress. Please stop it first.', 'warning');
      return;
    }
  
    const flattenedBlocks = [];
    workout.blocks.forEach((block) => {
      if (block.type === 'plannedSet') {
        for (let i = 0; i < block.plannedSetDetails.sets; i++) {
          flattenedBlocks.push({
            type: 'plannedSetInstance',
            exercise: block.plannedSetDetails.exercise,
            reps: block.plannedSetDetails.reps,
            weight: block.plannedSetDetails.weight,
            currentSetNum: i + 1,
            totalSets: block.plannedSetDetails.sets,
            originalPlannedSetId: block.plannedSetDetails.id,
            status: 'pending',
          });
          if (block.plannedSetDetails.restTime > 0) {
            flattenedBlocks.push({
              type: 'rest',
              duration: block.plannedSetDetails.restTime,
              originatingPlannedSet: block.plannedSetDetails.exercise,
              originatingSetNum: i + 1,
              status: 'pending',
            });
          }
        }
      } else {
        flattenedBlocks.push({ ...block, status: 'pending' });
      }
    });
  
    const firstActiveIndex = flattenedBlocks.findIndex(block => block.type !== 'note');
    if (firstActiveIndex !== -1) {
      for (let i = 0; i < firstActiveIndex; i++) {
        if (flattenedBlocks[i].type === 'note') {
          flattenedBlocks[i].status = 'completed';
        }
      }
      flattenedBlocks[firstActiveIndex].status = 'active';
      const firstActiveBlock = flattenedBlocks[firstActiveIndex];
      const sessionData = {
        active: true,
        activeWorkoutSession: workout,
        playbackBlocks: flattenedBlocks,
        isTimerRunning: false,
        timerSecondsLeft: 0,
        initialRestDuration: 0,
        startTime: Date.now(),
      };
      if (firstActiveBlock.type === 'rest') {
        sessionData.timerSecondsLeft = firstActiveBlock.duration;
        sessionData.initialRestDuration = firstActiveBlock.duration;
        sessionData.isTimerRunning = true;
      }
      await setDoc(sessionDocRef.current, sessionData);
    } else {
      showSnackbar('This workout has no sets or rest periods to start.', 'warning');
      return;
    }
  
    showSnackbar(`Starting workout: ${workout.name}`, 'info');
  };

  // --- Pause/Resume Handler ---
  const handlePauseResume = async () => {
    if (!userId) return;
    const docSnap = await getDoc(sessionDocRef.current);
    if (!docSnap.exists()) return;
    const isCurrentlyRunning = docSnap.data().isTimerRunning;
    const updateData = { isTimerRunning: !isCurrentlyRunning };
    // If we are pausing the timer, save the current time left to Firestore.
    if (isCurrentlyRunning) {
      updateData.timerSecondsLeft = timerSecondsLeft;
    }
    await setDoc(sessionDocRef.current, updateData, { merge: true });
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {activeWorkoutSession && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: '#4caf50', // Green color
          color: 'white',
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.3)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FitnessCenterIcon sx={{ mr: 1 }} />
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {activeWorkoutSession.name}
            </Typography>
            {elapsedSeconds > 0 && (
              <Box sx={{ ml: 3, display: 'flex', alignItems: 'center' }}>
                <WatchLaterIcon sx={{ mr: 1 }} />
                <Typography variant="body1">{formatTime(elapsedSeconds)}</Typography>
              </Box>
            )}
            {timerSecondsLeft > 0 && (
              <Box sx={{ ml: 3, display: 'flex', alignItems: 'center' }}>
                <TimerIcon sx={{ mr: 1 }} />
                <Typography variant="body1">{timerSecondsLeft}s</Typography>
              </Box>
            )}
          </Box>
          <Box>
            <IconButton onClick={handlePauseResume} size="small" color="inherit">
              {isTimerRunning ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton onClick={() => setIsFinishConfirmDialogOpen(true)} size="small" color="inherit">
              <CheckIcon />
            </IconButton>
            <IconButton onClick={handleStopWorkout} size="small" color="inherit">
              <StopIcon />
            </IconButton>
          </Box>
        </Box>
      )}

      <Container maxWidth="md" sx={{ mt: activeWorkoutSession ? 10 : 4 }}>
        <Box sx={{ my: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        </Box>

        {currentTab === 'sets' && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                Planned Sets
              </Typography>
              <IconButton
                color="primary"
                onClick={() => handleOpenForm(null)}
                aria-label="plan new set"
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
                <AddIcon fontSize="medium" sx={{ color: darkTheme.palette.background.paper }}/>
              </IconButton>
            </Box>

            <TextField
              label="Search Set"
              variant="outlined"
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 3 }}
              disabled={!userId}
            />

            {filteredWorkouts.length === 0 && plannedWorkouts.length > 0 && searchQuery !== '' ? (
              <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
                No matching sets found for "{searchQuery}".
              </Typography>
            ) : filteredWorkouts.length === 0 && (!userId || plannedWorkouts.length === 0) ? (
              <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
                {userId ? "No workouts planned yet. Click the '+' button to get started!" : 'Sign in to view and save your planned workouts.'}
              </Typography>
            ) : (
              <TableContainer>
                <Table aria-label="planned workout table">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Exercise</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Sets</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Reps</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Weight (kg)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Rest (s)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredWorkouts.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell component="th" scope="row">
                          {row.exercise}
                        </TableCell>
                        <TableCell align="right">{row.sets}</TableCell>
                        <TableCell align="right">{row.reps}</TableCell>
                        <TableCell align="right">{row.weight}</TableCell>
                        <TableCell align="right">{row.restTime}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            aria-label="edit"
                            color="primary"
                            onClick={() => handleOpenForm(row)}
                            size="small"
                            disabled={!userId}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            aria-label="delete"
                            color="error"
                            onClick={() => deletePlannedWorkout(row.id)}
                            size="small"
                            disabled={!userId}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {currentTab === 'workout' && (
          <WorkoutTracker
            userId={userId}
            appId={appId}
            db={db}
            plannedWorkouts={plannedWorkouts}
            showSnackbar={showSnackbar}
            activeWorkoutSession={activeWorkoutSession}
            playbackBlocks={playbackBlocks}
            timerSecondsLeft={timerSecondsLeft}
            initialRestDuration={initialRestDuration}
            isTimerRunning={isTimerRunning}
            handleStartWorkoutSession={handleStartWorkoutSession}
            handleBlockCompletion={handleBlockCompletion}
            handlePauseResume={handlePauseResume}
            handleStopWorkout={handleStopWorkout}
            advanceToNextActiveBlock={advanceToNextActiveBlock}
            setActiveWorkoutSession={setActiveWorkoutSession}
            setPlaybackBlocks={setPlaybackBlocks}
            setIsTimerRunning={setIsTimerRunning}
            setTimerSecondsLeft={setTimerSecondsLeft}
            setInitialRestDuration={setInitialRestDuration}
          />
        )}

        {currentTab === 'settings' && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
            <SettingsIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
              Settings
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
              Manage app preferences and user profile here.
            </Typography>
            {!userId ? (
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Sign in with Google to save your workout plans and access all features.
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleGoogleSignIn}
                        sx={{ borderRadius: '8px', px: 4, py: 1.5 }}
                    >
                        Sign In with Google
                    </Button>
                </Box>
            ) : (
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        You are signed in. User ID: <strong>{userId}</strong>
                    </Typography>
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handleSignOut}
                        sx={{ borderRadius: '8px', px: 4, py: 1.5 }}
                    >
                        Sign Out
                    </Button>
                </Box>
            )}
          </Paper>
        )}

        <Dialog open={isFormOpen} onClose={handleCloseForm} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ textAlign: 'center', pb: 1, color: 'primary.main' }}>
            {editingWorkoutId ? 'Edit Workout Set' : 'Plan New Workout Set'}
          </DialogTitle>
          <DialogContent>
            <Box
              component="form"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                mt: 1,
              }}
              noValidate
              autoComplete="off"
            >
              <TextField
                label="Exercise Name"
                variant="outlined"
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                label="Sets"
                variant="outlined"
                type="number"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                inputProps={{ min: 1 }}
                fullWidth
              />
              <TextField
                label="Reps"
                variant="outlined"
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                inputProps={{ min: 1 }}
                fullWidth
              />
              <TextField
                label="Weight (kg)"
                variant="outlined"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputProps={{ min: 0, step: 0.5 }}
                fullWidth
              />
              <TextField
                label="Rest Time (seconds)"
                variant="outlined"
                type="number"
                value={restTime}
                onChange={(e) => setRestTime(e.target.value)}
                inputProps={{ min: 0 }}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleCloseForm}
              sx={{ borderRadius: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveWorkout}
              sx={{ borderRadius: 1 }}
            >
              {editingWorkoutId ? 'Save Changes' : 'Plan Set'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={isFinishConfirmDialogOpen} onClose={() => setIsFinishConfirmDialogOpen(false)}>
          <DialogTitle>Finish Workout</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to finish this workout?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsFinishConfirmDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleFinishWorkoutAndSave} color="primary">
              Finish
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleCloseSnackbar}>
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container>

      <Paper sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderRadius: '12px 12px 0 0',
        bgcolor: 'background.paper',
        py: 1,
        boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.3)',
      }} elevation={5}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
          sx={{
            minHeight: '60px',
            '& .MuiTabs-indicator': {
              height: '4px',
              borderRadius: '2px',
            },
          }}
        >
          <Tab
            label="Workouts"
            value="workout"
            icon={<FitnessCenterIcon />}
            sx={{
              flexDirection: 'column',
              fontSize: '0.75rem',
              minWidth: 'auto',
              px: 2,
              color: currentTab === 'workout' ? darkTheme.palette.primary.main : darkTheme.palette.text.secondary,
              '&.Mui-selected': {
                color: darkTheme.palette.primary.main,
              },
            }}
          />
          <Tab
            label="Sets"
            value="sets"
            icon={<AddIcon />}
            sx={{
              flexDirection: 'column',
              fontSize: '0.75rem',
              minWidth: 'auto',
              px: 2,
              color: currentTab === 'sets' ? darkTheme.palette.primary.main : darkTheme.palette.text.secondary,
              '&.Mui-selected': {
                color: darkTheme.palette.primary.main,
              },
            }}
          />
          <Tab
            label="Settings"
            value="settings"
            icon={<SettingsIcon />}
            sx={{
              flexDirection: 'column',
              fontSize: '0.75rem',
              minWidth: 'auto',
              px: 2,
              color: currentTab === 'settings' ? darkTheme.palette.primary.main : darkTheme.palette.text.secondary,
              '&.Mui-selected': {
                color: darkTheme.palette.primary.main,
              },
            }}
          />
        </Tabs>
      </Paper>
    </ThemeProvider>
  );
};

export default App;