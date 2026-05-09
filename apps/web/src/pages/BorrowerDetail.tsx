import { useEffect, useState } from 'react';
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
import { ArrowBack, Refresh, Article, CheckCircle, Cancel, Edit, PendingActions } from '@mui/icons-material';
import { useBorrowerStore } from '../store/borrowerStore';
import { ExtractedFieldDisplay } from '../components/ExtractedFieldDisplay';
import { ReviewActions } from '../components/ReviewActions';
import { EditFieldDialog } from '../components/EditFieldDialog';
import { ReviewStatus, ExtractedField } from '@loanlens/domain';

interface EditingField {
  fieldName: string;
  fieldLabel: string;
  field?: ExtractedField;
}

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

  // Edit field dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<EditingField | null>(null);

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

  // Get review status display info
  const getReviewStatusInfo = () => {
    switch (selectedBorrower.reviewStatus) {
      case ReviewStatus.APPROVED:
        return { color: 'success' as const, icon: <CheckCircle />, label: 'Approved' };
      case ReviewStatus.REJECTED:
        return { color: 'error' as const, icon: <Cancel />, label: 'Rejected' };
      case ReviewStatus.CORRECTED:
        return { color: 'warning' as const, icon: <Edit />, label: 'Corrected' };
      case ReviewStatus.PENDING_REVIEW:
      default:
        return { color: 'default' as const, icon: <PendingActions />, label: 'Pending Review' };
    }
  };

  // Handle successful review action
  const handleReviewSuccess = () => {
    // Refresh the borrower data
    if (id) {
      fetchBorrowerById(id);
    }
  };

  // Check if editing is allowed
  const canEditFields = selectedBorrower &&
    (selectedBorrower.reviewStatus === ReviewStatus.PENDING_REVIEW ||
     selectedBorrower.reviewStatus === ReviewStatus.CORRECTED);

  // Handle opening edit dialog
  const handleOpenEdit = (fieldName: string, fieldLabel: string, field?: ExtractedField) => {
    setEditingField({ fieldName, fieldLabel, field });
    setEditDialogOpen(true);
  };

  // Handle closing edit dialog
  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setEditingField(null);
  };

  // Handle successful field edit
  const handleEditSuccess = () => {
    // Refresh the borrower data
    if (id) {
      fetchBorrowerById(id);
    }
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
          <Chip
            icon={getReviewStatusInfo().icon}
            label={getReviewStatusInfo().label}
            color={getReviewStatusInfo().color}
            size="medium"
          />
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
              canEdit={!!canEditFields}
              onEdit={() => handleOpenEdit('fullName', 'Full Name', selectedBorrower.fullName)}
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
                      canEdit={!!canEditFields}
                      onEdit={() => handleOpenEdit('firstName', 'First Name', selectedBorrower.firstName)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <ExtractedFieldDisplay
                      label="Last Name"
                      field={selectedBorrower.lastName}
                      onViewSource={handleViewSource}
                      canEdit={!!canEditFields}
                      onEdit={() => handleOpenEdit('lastName', 'Last Name', selectedBorrower.lastName)}
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
              canEdit={!!canEditFields}
              onEdit={() => handleOpenEdit('dateOfBirth', 'Date of Birth', selectedBorrower.dateOfBirth)}
            />

            <Divider sx={{ my: 2 }} />
            <ExtractedFieldDisplay
              label="SSN"
              field={selectedBorrower.ssn}
              onViewSource={handleViewSource}
              canEdit={!!canEditFields}
              onEdit={() => handleOpenEdit('ssn', 'SSN', selectedBorrower.ssn)}
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
              canEdit={!!canEditFields}
              onEdit={() => handleOpenEdit('email', 'Email', selectedBorrower.email)}
            />

            <Divider sx={{ my: 2 }} />
            <ExtractedFieldDisplay
              label="Phone Number"
              field={selectedBorrower.phoneNumber}
              onViewSource={handleViewSource}
              canEdit={!!canEditFields}
              onEdit={() => handleOpenEdit('phoneNumber', 'Phone Number', selectedBorrower.phoneNumber)}
            />

            {selectedBorrower.alternatePhoneNumber && (
              <>
                <Divider sx={{ my: 2 }} />
                <ExtractedFieldDisplay
                  label="Alternate Phone"
                  field={selectedBorrower.alternatePhoneNumber}
                  onViewSource={handleViewSource}
                  canEdit={!!canEditFields}
                  onEdit={() => handleOpenEdit('alternatePhoneNumber', 'Alternate Phone', selectedBorrower.alternatePhoneNumber)}
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

        {/* Review Actions */}
        {(selectedBorrower.reviewStatus === ReviewStatus.PENDING_REVIEW ||
          selectedBorrower.reviewStatus === ReviewStatus.CORRECTED) && (
          <Grid item xs={12}>
            <ReviewActions
              borrowerId={selectedBorrower.id}
              currentStatus={selectedBorrower.reviewStatus}
              borrowerName={getDisplayName()}
              onSuccess={handleReviewSuccess}
            />
          </Grid>
        )}

        {/* Review Information (for reviewed borrowers) */}
        {(selectedBorrower.reviewStatus === ReviewStatus.APPROVED ||
          selectedBorrower.reviewStatus === ReviewStatus.REJECTED) &&
          selectedBorrower.reviewedAt && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Review Information
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Review Status
                  </Typography>
                  <Chip
                    icon={getReviewStatusInfo().icon}
                    label={getReviewStatusInfo().label}
                    color={getReviewStatusInfo().color}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Reviewed At
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {selectedBorrower.reviewedAt.toLocaleString()}
                  </Typography>
                </Grid>

                {selectedBorrower.reviewerNotes && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Reviewer Notes
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, mt: 0.5, bgcolor: 'grey.50' }}>
                      <Typography variant="body2">
                        {selectedBorrower.reviewerNotes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
        )}

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

      {/* Edit Field Dialog */}
      {editingField && selectedBorrower && (
        <EditFieldDialog
          open={editDialogOpen}
          onClose={handleCloseEdit}
          borrowerId={selectedBorrower.id}
          fieldName={editingField.fieldName}
          fieldLabel={editingField.fieldLabel}
          field={editingField.field}
          onSuccess={handleEditSuccess}
        />
      )}
    </Box>
  );
}
