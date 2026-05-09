import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import { Visibility, Refresh } from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';

export function ReviewQueue() {
  const navigate = useNavigate();
  const { reviewQueue, pagination, isLoading, error, fetchReviewQueue, clearError } = useReviewStore();

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const handleRefresh = () => {
    fetchReviewQueue();
  };

  const handleViewBorrower = (id: string) => {
    navigate(`/borrowers/${id}`);
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  // Loading state
  if (isLoading && reviewQueue.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Review Queue
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pagination ? `${pagination.total} borrower${pagination.total !== 1 ? 's' : ''} pending review` : 'Loading...'}
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} disabled={isLoading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Empty state */}
      {reviewQueue.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Borrowers Pending Review
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All borrowers have been reviewed. Great job!
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>SSN</TableCell>
                <TableCell>Date of Birth</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Extracted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviewQueue.map((borrower) => {
                // Calculate average confidence
                const confidences = [
                  borrower.fullName?.confidence,
                  borrower.ssn?.confidence,
                  borrower.dateOfBirth?.confidence,
                  borrower.email?.confidence,
                  borrower.phoneNumber?.confidence
                ].filter((c) => c !== undefined) as number[];

                const avgConfidence =
                  confidences.length > 0
                    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
                    : 0;

                return (
                  <TableRow
                    key={borrower.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewBorrower(borrower.id)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {borrower.fullName?.value || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {borrower.ssn?.value || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {borrower.dateOfBirth?.value || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{borrower.email?.value || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {borrower.phoneNumber?.value || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${(avgConfidence * 100).toFixed(0)}%`}
                        size="small"
                        color={getConfidenceColor(avgConfidence)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {borrower.updatedAt.toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewBorrower(borrower.id);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
