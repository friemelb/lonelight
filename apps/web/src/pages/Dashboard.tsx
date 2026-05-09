import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Alert,
  Snackbar,
  Skeleton,
  Stack,
  Divider
} from '@mui/material';
import { CloudUpload, AutoAwesome, DeleteSweep, Refresh } from '@mui/icons-material';
import { useAppStore } from '@/store/appStore';
import { useMetricsStore } from '@/store/metricsStore';
import { useDocumentStore } from '@/store/documentStore';
import { useBorrowerStore } from '@/store/borrowerStore';

interface ActionToast {
  severity: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export function Dashboard() {
  const { apiHealth, fetchHealthCheck } = useAppStore();
  const { metrics, isLoading: metricsLoading, error: metricsError, fetchMetrics } = useMetricsStore();
  const { ingestDocuments } = useDocumentStore();
  const { extractBorrowers, isExtracting } = useBorrowerStore();

  const [resetLoading, setResetLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [toast, setToast] = useState<ActionToast | null>(null);

  useEffect(() => {
    fetchHealthCheck();
    fetchMetrics();

    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchHealthCheck, fetchMetrics]);

  const handleRunIngestion = async () => {
    setIngestLoading(true);
    try {
      const result = await ingestDocuments();
      const extracted = result.borrowersExtracted ?? 0;
      const summary =
        `Ingested ${result.successful} of ${result.total} files` +
        (extracted > 0 ? `; extracted ${extracted} borrowers` : '');
      setToast({
        severity: result.failed > 0 ? 'warning' : 'success',
        message: summary
      });
      fetchMetrics();
    } catch (error) {
      setToast({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Ingestion failed'
      });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleRunExtraction = async () => {
    try {
      const result = await extractBorrowers();
      setToast({
        severity: result.success ? 'success' : 'warning',
        message: result.success
          ? `Extracted ${result.borrowersExtracted} borrowers from ${result.totalDocuments} documents in ${(result.durationMs / 1000).toFixed(1)}s`
          : `Extraction reported issues: ${result.errors[0]?.message ?? 'see logs'}`
      });
      fetchMetrics();
    } catch (error) {
      setToast({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Extraction failed'
      });
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('This will delete ALL data in the database. This cannot be undone. Continue?')) {
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch('/api/debug/reset-database', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to reset database');
      }
      await response.json();
      setToast({ severity: 'success', message: 'Database reset successfully' });
      fetchHealthCheck();
      fetchMetrics();
    } catch (error) {
      setToast({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Reset failed'
      });
    } finally {
      setResetLoading(false);
    }
  };

  const renderMetric = (
    label: string,
    value: string | number | undefined,
    color: 'text.primary' | 'success.main' | 'error.main' | 'warning.main' | 'info.main' = 'text.primary',
    caption?: string
  ) => (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {label}
      </Typography>
      {metricsLoading && metrics === null ? (
        <Skeleton variant="text" width={80} height={56} />
      ) : (
        <Typography variant="h3" color={color}>
          {value ?? '—'}
        </Typography>
      )}
      {caption && (
        <Typography variant="body2" color="text.secondary">
          {caption}
        </Typography>
      )}
    </Paper>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Pipeline actions — primary entry point for the demo flow */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <Box>
            <Typography variant="h6" gutterBottom>
              Pipeline Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Run ingestion to scan the corpus directory, then run extraction to pull borrower
              data with the LLM. Both steps are idempotent at the action level — re-running them
              is safe.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<CloudUpload />}
              onClick={handleRunIngestion}
              disabled={ingestLoading || isExtracting}
            >
              {ingestLoading ? 'Running ingestion…' : 'Run Ingestion'}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<AutoAwesome />}
              onClick={handleRunExtraction}
              disabled={ingestLoading || isExtracting}
            >
              {isExtracting ? 'Running extraction…' : 'Run Extraction'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Refresh />}
              onClick={() => {
                fetchHealthCheck();
                fetchMetrics();
              }}
              disabled={metricsLoading}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {metricsError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => fetchMetrics()}>
          Failed to load metrics: {metricsError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* API status & destructive admin */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              API Status
            </Typography>
            {apiHealth ? (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="success.main">
                  Status: {apiHealth.status}
                </Typography>
                <Typography variant="body2">Service: {apiHealth.service}</Typography>
                <Typography variant="body2">Version: {apiHealth.version}</Typography>
                <Typography variant="body2">
                  Uptime: {Math.floor(apiHealth.uptime)}s
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="error">
                Unable to connect to API
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteSweep />}
              onClick={handleResetDatabase}
              disabled={resetLoading}
              fullWidth
            >
              {resetLoading ? 'Resetting…' : 'Reset Database'}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          {renderMetric('Total Documents', metrics?.totalDocuments, 'text.primary', 'Documents in system')}
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          {renderMetric('Extracted Documents', metrics?.byStatus.extracted, 'success.main', 'Successfully processed')}
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          {renderMetric('Failed Documents', metrics?.byStatus.failed, 'error.main', 'Processing failures')}
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          {renderMetric('Total Chunks', metrics?.totalChunks, 'text.primary', 'Text chunks created')}
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          {renderMetric(
            'Success Rate',
            metrics ? `${metrics.successRate.toFixed(1)}%` : undefined,
            'success.main',
            'Processing success rate'
          )}
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          {renderMetric(
            'Avg Processing Time',
            metrics ? `${metrics.avgProcessingTimeMs}ms` : undefined,
            'text.primary',
            'Per document'
          )}
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          {renderMetric(
            'Recent Errors',
            metrics?.recentErrorCount,
            metrics && metrics.recentErrorCount > 0 ? 'warning.main' : 'text.primary',
            'Last 24 hours'
          )}
        </Grid>

        {/* Review Metrics Section Header */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
            Review Workflow Metrics
          </Typography>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          {renderMetric('Pending Reviews', metrics?.reviewCounts.pendingReview, 'warning.main', 'Awaiting review')}
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          {renderMetric('Approved Records', metrics?.reviewCounts.approved, 'success.main', 'Approved borrowers')}
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          {renderMetric('Rejected Records', metrics?.reviewCounts.rejected, 'error.main', 'Rejected borrowers')}
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          {renderMetric('Corrected Records', metrics?.reviewCounts.corrected, 'info.main', 'With corrections')}
        </Grid>
      </Grid>

      {toast && (
        <Snackbar
          open
          autoHideDuration={6000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast(null)}
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
}
