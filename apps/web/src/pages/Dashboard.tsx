import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Button, Alert, Snackbar } from '@mui/material';
import { DeleteSweep } from '@mui/icons-material';
import { useAppStore } from '@/store/appStore';
import { useMetricsStore } from '@/store/metricsStore';

export function Dashboard() {
  const { apiHealth, fetchHealthCheck } = useAppStore();
  const { metrics, fetchMetrics } = useMetricsStore();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthCheck();
    fetchMetrics();

    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchHealthCheck, fetchMetrics]);

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

      // Refresh health check and metrics after reset
      fetchHealthCheck();
      fetchMetrics();
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
        {/* Total Documents */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Documents
            </Typography>
            <Typography variant="h3">
              {metrics?.totalDocuments ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Documents in system
            </Typography>
          </Paper>
        </Grid>

        {/* Documents by Status */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Extracted Documents
            </Typography>
            <Typography variant="h3" color="success.main">
              {metrics?.byStatus.extracted ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Successfully processed
            </Typography>
          </Paper>
        </Grid>

        {/* Failed Documents */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Failed Documents
            </Typography>
            <Typography variant="h3" color="error.main">
              {metrics?.byStatus.failed ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Processing failures
            </Typography>
          </Paper>
        </Grid>

        {/* Total Chunks */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Total Chunks
            </Typography>
            <Typography variant="h3">
              {metrics?.totalChunks ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Text chunks created
            </Typography>
          </Paper>
        </Grid>

        {/* Success Rate */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Success Rate
            </Typography>
            <Typography variant="h3" color="success.main">
              {metrics ? `${metrics.successRate.toFixed(1)}%` : '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Processing success rate
            </Typography>
          </Paper>
        </Grid>

        {/* Avg Processing Time */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Avg Processing Time
            </Typography>
            <Typography variant="h3">
              {metrics ? `${metrics.avgProcessingTimeMs}ms` : '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Per document
            </Typography>
          </Paper>
        </Grid>

        {/* Recent Errors */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Errors
            </Typography>
            <Typography variant="h3" color={metrics && metrics.recentErrorCount > 0 ? 'warning.main' : 'text.primary'}>
              {metrics?.recentErrorCount ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last 24 hours
            </Typography>
          </Paper>
        </Grid>

        {/* Review Metrics Section Header */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
            Review Workflow Metrics
          </Typography>
        </Grid>

        {/* Pending Reviews */}
        <Grid item xs={12} md={6} lg={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Pending Reviews
            </Typography>
            <Typography variant="h3" color="warning.main">
              {metrics?.reviewCounts.pendingReview ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Awaiting review
            </Typography>
          </Paper>
        </Grid>

        {/* Approved Records */}
        <Grid item xs={12} md={6} lg={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Approved Records
            </Typography>
            <Typography variant="h3" color="success.main">
              {metrics?.reviewCounts.approved ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approved borrowers
            </Typography>
          </Paper>
        </Grid>

        {/* Rejected Records */}
        <Grid item xs={12} md={6} lg={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Rejected Records
            </Typography>
            <Typography variant="h3" color="error.main">
              {metrics?.reviewCounts.rejected ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rejected borrowers
            </Typography>
          </Paper>
        </Grid>

        {/* Corrected Records */}
        <Grid item xs={12} md={6} lg={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Corrected Records
            </Typography>
            <Typography variant="h3" color="info.main">
              {metrics?.reviewCounts.corrected ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              With corrections
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
