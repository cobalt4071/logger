import React, { useState, useEffect } from 'react';
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
  Tabs, // Import Tabs component
  Tab,  // Import Tab component
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'; // Icon for Workout tab
import SettingsIcon from '@mui/icons-material/Settings'; // Icon for Settings tab
import AddIcon from '@mui/icons-material/Add'; // Changed import

// Import Firebase modules
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  onSnapshot, // For real-time updates
  addDoc,
  setDoc,
  deleteDoc,
  doc, // For referencing specific documents
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider, // Import GoogleAuthProvider
  signInWithPopup,    // Import signInWithPopup
  signOut,          // Import signOut for logout functionality
  onAuthStateChanged,
} from "firebase/auth";

// Import the new WorkoutTracker component
import WorkoutTracker from './WorkoutTracker';


// Your web app's Firebase configuration (provided by you)
const firebaseConfig = {
  apiKey: "AIzaSyB9f6MkvYWglCB_YTwJ7pzIBn_imyXmVJQ",
  authDomain: "cobalt4071-logger.firebaseapp.com",
  projectId: "cobalt4071-logger",
  storageBucket: "cobalt4071-logger.firebasestorage.app",
  messagingSenderId: "643454758270",
  appId: "1:643454758270:web:284006db9753e146f0172f",
  measurementId: "G-MR5H9ZVE34"
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
  // State to hold the list of planned workout entries
  const [plannedWorkouts, setPlannedWorkouts] = useState([]);
  // State for the current exercise being planned
  const [exercise, setExercise] = useState('');
  // State for the current sets value
  const [sets, setSets] = useState('');
  // State for the current reps value
  const [reps, setReps] = useState('');
  // State for the current weight value
  const [weight, setWeight] = useState('');
  // State for the current rest time value
  const [restTime, setRestTime] = useState('');
  // State to control the visibility of the plan workout form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  // State to store the ID of the workout being edited (null for new workout)
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  // State for Snackbar (for notifications)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  // State for the search query
  const [searchQuery, setSearchQuery] = useState('');
  // State for user ID (for Firestore data separation)
  const [userId, setUserId] = useState(null);
  // State to track if auth is ready to fetch Firestore data
  const [isAuthReady, setIsAuthReady] = useState(false);

  // New state for tab navigation: 'workout', 'sets', 'settings'
  const [currentTab, setCurrentTab] = useState('sets');


  // 1. Firebase Authentication Setup
  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true); // Auth is ready, can now fetch Firestore data
        console.log("Auth state changed. User ID:", user.uid);
      } else {
        setUserId(null);
        setIsAuthReady(true); // Still set ready, even if no user, to allow unauthenticated state
        console.log("Auth state changed. No user signed in.");
        // If no user, showSnackbar is now handled directly in the Settings tab
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array means this runs once on component mount

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


  // 2. Load planned workouts from Firestore on auth ready
  useEffect(() => {
    // Only fetch if auth is ready and userId is available
    if (isAuthReady && userId) {
      const workoutCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`);
      const q = query(workoutCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
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

      // Cleanup subscription on unmount or userId change
      return () => unsubscribe();
    } else if (isAuthReady && !userId) {
      // If auth is ready but no user (e.g., not signed in yet)
      // Clear workouts as no user data can be loaded.
      setPlannedWorkouts([]);
    }
  }, [isAuthReady, userId]); // Only depend on isAuthReady and userId

  // Function to show Snackbar notifications
  const showSnackbar = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
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
      // If editing, populate fields and set editing ID
      setExercise(workoutToEdit.exercise);
      setSets(workoutToEdit.sets);
      setReps(workoutToEdit.reps);
      setWeight(workoutToEdit.weight);
      setRestTime(workoutToEdit.restTime);
      setEditingWorkoutId(workoutToEdit.id);
    } else {
      // If adding new, clear fields and reset editing ID
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
    // Always clear fields and reset editing ID when closing
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

    // Input validation (kept from previous version)
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

    const workoutData = {
      exercise: exercise.trim(),
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight: parseFloat(weight),
      restTime: parseInt(restTime),
      userId: userId, // Store the user ID with the workout
      createdAt: Date.now(), // Timestamp for sorting
    };

    try {
      if (editingWorkoutId) {
        // Update existing document
        const workoutDocRef = doc(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`, editingWorkoutId);
        await setDoc(workoutDocRef, workoutData, { merge: true }); // Use setDoc with merge for partial updates
        showSnackbar('Workout plan updated in cloud!', 'success');
      } else {
        // Add new document
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/plannedWorkouts`), workoutData);
        showSnackbar('Workout set planned and saved to cloud!', 'success');
      }
    } catch (error) {
      console.error('Error saving workout to Firestore:', error);
      showSnackbar(`Failed to save workout: ${error.message}`, 'error');
    }

    // Clear input fields and close modal
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

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
      <Container maxWidth="md">
        <Box sx={{ my: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Main heading removed */}
        </Box>

        {/* Conditional rendering based on currentTab */}
        {currentTab === 'sets' && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                Planned Sets
              </Typography>
              {/* Add Set button, now filled in blue */}
              <IconButton
                color="primary"
                onClick={() => handleOpenForm(null)}
                aria-label="plan new set"
                disabled={!userId} // Disable if not signed in
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

            {/* Search Bar */}
            <TextField
              label="Search Set"
              variant="outlined"
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 3 }}
              disabled={!userId} // Disable if not signed in
            />

            {filteredWorkouts.length === 0 && plannedWorkouts.length > 0 && searchQuery !== '' ? (
              <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
                No matching sets found for "{searchQuery}".
              </Typography>
            ) : filteredWorkouts.length === 0 && (!userId || plannedWorkouts.length === 0) ? (
              <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mt: 2 }}>
                {userId ? 'No workouts planned yet. Click the \'+\' button to get started!' : 'Sign in to view and save your planned workouts.'}
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
                    {/* Map over filteredWorkouts to display each entry */}
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
                            disabled={!userId} // Disable if not signed in
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            aria-label="delete"
                            color="error"
                            onClick={() => deletePlannedWorkout(row.id)}
                            size="small"
                            disabled={!userId} // Disable if not signed in
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

            {/* Conditional rendering for Sign In / Sign Out buttons */}
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
            {/* Future settings options will go here */}
          </Paper>
        )}


        {/* The Modal/Prompt for planning a new set or editing an existing one */}
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

        {/* Snackbar for notifications */}
        <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleCloseSnackbar}>
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container>

      {/* Bottom Navigation Bar using Material-UI Tabs */}
      <Paper sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderRadius: '12px 12px 0 0', // Rounded top corners only
        bgcolor: 'background.paper',
        py: 1,
        boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.3)', // Subtle shadow
      }} elevation={5}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
          sx={{
            minHeight: '60px', // Ensure consistent height
            '& .MuiTabs-indicator': {
              height: '4px', // Thicker indicator
              borderRadius: '2px', // Rounded indicator
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
              minWidth: 'auto', // Allow content to dictate width
              px: 2, // Padding for better spacing
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