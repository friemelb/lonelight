import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Button, Alert, Snackbar } from '@mui/material';
import { DeleteSweep } from '@mui/icons-material';
import { useAppStore } from '@/store/appStore';

export function Dashboard() {
  const { apiHealth, fetchHealthCheck } = useAppStore();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthCheck();
  }, [fetchHealthCheck]);

  const handleResetDatabase = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL data in the database. This cannot be undone. Are you sure?')) {
      return;
    }

    setResetLoading(true);
    setResetError(null);

    try {
      const response = await fetch('/api/debug/reset-database', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Failed to reset database');
      }

      await response.json();
      setResetSuccess(true);

      // Refresh health check after reset
      fetchHealthCheck();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

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

            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteSweep />}
              onClick={handleResetDatabase}
              disabled={resetLoading}
              fullWidth
              sx={{ mt: 2 }}
            >
              {resetLoading ? 'Resetting...' : 'Reset Database'}
            </Button>

            {resetError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {resetError}
              </Alert>
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

      <Snackbar
        open={resetSuccess}
        autoHideDuration={6000}
        onClose={() => setResetSuccess(false)}
      >
        <Alert severity="success" onClose={() => setResetSuccess(false)}>
          Database reset successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
}
