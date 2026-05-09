import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  Divider,
  Grid,
  Chip,
  Button
} from '@mui/material';
import { ArrowBack, Refresh, Article } from '@mui/icons-material';
import { useBorrowerStore } from '../store/borrowerStore';
import { ExtractedFieldDisplay } from '../components/ExtractedFieldDisplay';

export function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    selectedBorrower,
    isLoading,
    error,
    fetchBorrowerById,
    clearError
  } = useBorrowerStore();

  // Fetch borrower on mount or when ID changes
  useEffect(() => {
    if (id) {
      fetchBorrowerById(id);
    }
  }, [id]);

  // Handle back navigation
  const handleBack = () => {
    navigate('/borrowers');
  };

  // Handle refresh
  const handleRefresh = () => {
    if (id) {
      fetchBorrowerById(id);
    }
  };

  // Handle view source document
  const handleViewSource = (documentId: string, page?: number) => {
    if (page) {
      navigate(`/documents/${documentId}?page=${page}`);
    } else {
      navigate(`/documents/${documentId}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <IconButton onClick={handleBack}>
            <ArrowBack />
          </IconButton>
          <Skeleton width={300} height={40} />
        </Stack>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={400} />
        </Paper>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <IconButton onClick={handleBack}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Borrower Details</Typography>
        </Stack>
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
        <Button onClick={handleRefresh} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  // No borrower found
  if (!selectedBorrower) {
    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <IconButton onClick={handleBack}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">Borrower Not Found</Typography>
        </Stack>
        <Alert severity="warning">
          The requested borrower could not be found.
        </Alert>
      </Box>
    );
  }

  // Get display name
  const getDisplayName = () => {
    if (selectedBorrower.fullName?.value) {
      return selectedBorrower.fullName.value;
    }
    const first = selectedBorrower.firstName?.value || '';
    const last = selectedBorrower.lastName?.value || '';
    if (first && last) {
      return `${first} ${last}`;
    }
    return first || last || 'Unnamed Borrower';
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title="Back to borrowers">
            <IconButton onClick={handleBack}>
              <ArrowBack />
            </IconButton>
          </Tooltip>
          <Typography variant="h4">
            {getDisplayName()}
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <ExtractedFieldDisplay
              label="Full Name"
              field={selectedBorrower.fullName}
              onViewSource={handleViewSource}
            />

            {(selectedBorrower.firstName || selectedBorrower.lastName) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <ExtractedFieldDisplay
                      label="First Name"
                      field={selectedBorrower.firstName}
                      onViewSource={handleViewSource}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <ExtractedFieldDisplay
                      label="Last Name"
                      field={selectedBorrower.lastName}
                      onViewSource={handleViewSource}
                    />
                  </Grid>
                </Grid>
              </>
            )}

            <Divider sx={{ my: 2 }} />
            <ExtractedFieldDisplay
              label="Date of Birth"
              field={selectedBorrower.dateOfBirth}
              onViewSource={handleViewSource}
            />

            <Divider sx={{ my: 2 }} />
            <ExtractedFieldDisplay
              label="SSN"
              field={selectedBorrower.ssn}
              onViewSource={handleViewSource}
            />
          </Paper>
        </Grid>

        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <ExtractedFieldDisplay
              label="Email"
              field={selectedBorrower.email}
              onViewSource={handleViewSource}
            />

            <Divider sx={{ my: 2 }} />
            <ExtractedFieldDisplay
              label="Phone Number"
              field={selectedBorrower.phoneNumber}
              onViewSource={handleViewSource}
            />

            {selectedBorrower.alternatePhoneNumber && (
              <>
                <Divider sx={{ my: 2 }} />
                <ExtractedFieldDisplay
                  label="Alternate Phone"
                  field={selectedBorrower.alternatePhoneNumber}
                  onViewSource={handleViewSource}
                />
              </>
            )}
          </Paper>
        </Grid>

        {/* Document Summary */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Document Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack direction="row" spacing={3} alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Documents
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Article color="primary" />
                  <Chip
                    label={selectedBorrower.documentIds.length}
                    color={selectedBorrower.documentIds.length > 0 ? 'primary' : 'default'}
                  />
                </Stack>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {selectedBorrower.createdAt.toLocaleString()}
                </Typography>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {selectedBorrower.updatedAt.toLocaleString()}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Metadata */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary">
              Borrower ID
            </Typography>
            <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2 }}>
              {selectedBorrower.id}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
