import { Box, Typography, Paper } from '@mui/material';

export function Borrowers() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Borrowers
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Borrower management interface coming soon...
        </Typography>
      </Paper>
    </Box>
  );
}
