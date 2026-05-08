import { useEffect } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useAppStore } from '@/store/appStore';

export function Dashboard() {
  const { apiHealth, fetchHealthCheck } = useAppStore();

  useEffect(() => {
    fetchHealthCheck();
  }, [fetchHealthCheck]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              API Status
            </Typography>
            {apiHealth ? (
              <Box>
                <Typography variant="body2" color="success.main">
                  Status: {apiHealth.status}
                </Typography>
                <Typography variant="body2">
                  Service: {apiHealth.service}
                </Typography>
                <Typography variant="body2">
                  Version: {apiHealth.version}
                </Typography>
                <Typography variant="body2">
                  Uptime: {Math.floor(apiHealth.uptime)}s
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="error">
                Unable to connect to API
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Documents
            </Typography>
            <Typography variant="h3">0</Typography>
            <Typography variant="body2" color="text.secondary">
              Total documents processed
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Borrowers
            </Typography>
            <Typography variant="h3">0</Typography>
            <Typography variant="body2" color="text.secondary">
              Total borrowers extracted
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
