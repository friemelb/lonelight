import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
  Alert,
  CircularProgress,
  Typography,
  Paper
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { useReviewStore } from '../store/reviewStore';
import { ReviewStatus } from '@loanlens/domain';

interface ReviewActionsProps {
  borrowerId: string;
  currentStatus: ReviewStatus;
  borrowerName: string;
  onSuccess?: () => void;
}

type ActionType = 'approve' | 'reject' | null;

export function ReviewActions({
  borrowerId,
  currentStatus,
  borrowerName,
  onSuccess
}: ReviewActionsProps) {
  const { approveBorrower, rejectBorrower, isSubmitting, error, clearError } = useReviewStore();
  const [notes, setNotes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType>(null);

  // Only show actions if status is pending_review or corrected
  const canReview =
    currentStatus === ReviewStatus.PENDING_REVIEW ||
    currentStatus === ReviewStatus.CORRECTED;

  if (!canReview) {
    return null;
  }

  const handleOpenDialog = (action: ActionType) => {
    setPendingAction(action);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setPendingAction(null);
    setNotes('');
    clearError();
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction === 'approve') {
        await approveBorrower(borrowerId, notes || undefined);
      } else if (pendingAction === 'reject') {
        await rejectBorrower(borrowerId, notes || undefined);
      }

      // Close dialog on success
      handleCloseDialog();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error is already set in the store, just leave dialog open
      console.error('Review action failed:', err);
    }
  };

  const getDialogTitle = () => {
    if (pendingAction === 'approve') {
      return 'Approve Borrower';
    }
    if (pendingAction === 'reject') {
      return 'Reject Borrower';
    }
    return '';
  };

  const getDialogMessage = () => {
    if (pendingAction === 'approve') {
      return `Are you sure you want to approve "${borrowerName}"? This will mark the borrower as approved and ready for processing.`;
    }
    if (pendingAction === 'reject') {
      return `Are you sure you want to reject "${borrowerName}"? This will mark the borrower as rejected and prevent further processing.`;
    }
    return '';
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Review Actions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review the extracted information above and approve or reject this borrower record.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<CheckCircle />}
            onClick={() => handleOpenDialog('approve')}
            fullWidth
            disabled={isSubmitting}
          >
            Approve
          </Button>
          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<Cancel />}
            onClick={() => handleOpenDialog('reject')}
            fullWidth
            disabled={isSubmitting}
          >
            Reject
          </Button>
        </Stack>

        {isSubmitting && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{getDialogTitle()}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {getDialogMessage()}
          </DialogContentText>

          {error && (
            <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Notes (Optional)"
            multiline
            rows={4}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes or comments about this decision..."
            disabled={isSubmitting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            color={pendingAction === 'approve' ? 'success' : 'error'}
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
          >
            {isSubmitting ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
