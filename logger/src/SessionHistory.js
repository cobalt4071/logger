import React from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  TextField,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import TimerIcon from '@mui/icons-material/Timer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const SessionHistory = ({ 
  sessionHistory, 
  formatDate, 
  formatTime, 
  deleteSessionHistoryEntry, 
  userId, 
  historySearchQuery, 
  setHistorySearchQuery, 
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate 
}) => {
  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2, position: 'relative' }}>
      <Typography variant="h6" sx={{ color: 'text.primary', mb: 2 }}>
        Recent Workouts
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Search Workouts"
          variant="outlined"
          fullWidth
          value={historySearchQuery}
          onChange={(e) => setHistorySearchQuery(e.target.value)}
        />
        <DatePicker
          label="Start"
          value={startDate}
          onChange={(newValue) => setStartDate(newValue)}
          renderInput={(params) => <TextField {...params} />}
        />
        <DatePicker
          label="End"
          value={endDate}
          onChange={(newValue) => setEndDate(newValue)}
          renderInput={(params) => <TextField {...params} />}
        />
      </Box>
      <Box sx={{ mb: 2, p: 1, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
        {sessionHistory.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ px: 2, py: 1 }}>
                {userId ? 'No recent workouts found.' : 'Sign in to see your recent workouts.'}
            </Typography>
        ) : (
            sessionHistory.map((session) => (
                <Accordion key={session.id} sx={{ bgcolor: 'background.paper', my: 1, '&:before': { display: 'none' } }}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                        aria-controls={`panel-${session.id}-content`}
                        id={`panel-${session.id}-header`}
                        sx={{
                            '& .MuiAccordionSummary-content': {
                                my: 0.5,
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            },
                        }}
                    >
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {session.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                {formatDate(session.date)}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 2 }}>
                            <Typography variant="body2" color="textSecondary">
                                Duration: {formatTime(session.duration)}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Sets: {session.completedSets}
                            </Typography>
                        </Box>
                        <IconButton
                            aria-label="delete"
                            color="error"
                            onClick={(e) => { e.stopPropagation(); deleteSessionHistoryEntry(session.id); }}
                            size="small"
                        >
                            <DeleteIcon />
                        </IconButton>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                        {session.blocks && session.blocks.map((block, blockIndex) => {
                            let blockContent;
                            switch (block.type) {
                                case 'plannedSetInstance':
                                    blockContent = `${block.exercise}: ${block.reps} reps @ ${block.weight}kg`;
                                    break;
                                case 'rest':
                                    const restColor = block.actualDuration < block.duration ? 'warning.main' : 'success.main';
                                    blockContent = (
                                        <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                                            <TimerIcon sx={{ fontSize: '1rem', mr: 0.5, color: 'info.main' }} />
                                            <Typography variant="body2" component="span">
                                                Rest: 
                                            </Typography>
                                            <Typography variant="body2" component="span" sx={{ color: restColor, ml: 0.5 }}>
                                                {block.actualDuration}s
                                            </Typography>
                                            <Typography variant="body2" component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                                                (planned: {block.duration}s)
                                            </Typography>
                                        </Box>
                                    );
                                    break;
                                case 'note':
                                    blockContent = `Note: "${block.text}"`;
                                    break;
                                default:
                                    blockContent = 'Unknown block';
                            }
                            return (
                                <Typography key={blockIndex} variant="body2" color="textSecondary" sx={{ ml: 1, my: 0.5 }}>
                                    - {blockContent}
                                </Typography>
                            );
                        })}
                    </AccordionDetails>
                </Accordion>
            ))
        )}
      </Box>
    </Paper>
  );
};

export default SessionHistory;