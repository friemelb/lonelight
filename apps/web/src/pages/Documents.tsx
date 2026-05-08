import { Box, Typography, Paper } from '@mui/material';

export function Documents() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Documents
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Document management interface coming soon...
        </Typography>
      </Paper>
    </Box>
  );
}
