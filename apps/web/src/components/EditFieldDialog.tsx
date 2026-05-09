import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  Divider,
  Stack,
  Chip,
  CircularProgress,
  Paper
} from '@mui/material';
import { ExtractedField } from '@loanlens/domain';
import { useReviewStore } from '../store/reviewStore';

interface EditFieldDialogProps {
  open: boolean;
  onClose: () => void;
  borrowerId: string;
  fieldName: string;
  fieldLabel: string;
  field?: ExtractedField;
  onSuccess?: () => void;
}

export function EditFieldDialog({
  open,
  onClose,
  borrowerId,
  fieldName,
  fieldLabel,
  field,
  onSuccess
}: EditFieldDialogProps) {
  const { correctField, isSubmitting, error, clearError } = useReviewStore();
  const [correctedValue, setCorrectedValue] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');

  // Reset form when dialog opens or field changes
  useEffect(() => {
    if (open && field) {
      setCorrectedValue(field.value || '');
      setCorrectionNote('');
      clearError();
    }
  }, [open, field]);

  const handleClose = () => {
    if (!isSubmitting) {
      setCorrectedValue('');
      setCorrectionNote('');
      clearError();
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!correctedValue.trim()) {
      return;
    }

    try {
      await correctField(borrowerId, fieldName, correctedValue.trim(), correctionNote || undefined);

      // Close dialog on success
      handleClose();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error is already set in the store
      console.error('Field correction failed:', err);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'default';
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const hasChanges = field && correctedValue.trim() !== field.value;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit {fieldLabel}</DialogTitle>
      <DialogContent>
        {/* Original Value Section */}
        {field && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Original Extracted Value
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body1" sx={{ flex: 1 }}>
                  {field.value || 'N/A'}
                </Typography>
                <Chip
                  label={`${Math.round((field.confidence || 0) * 100)}% confidence`}
                  size="small"
                  color={getConfidenceColor(field.confidence)}
                />
              </Stack>
            </Paper>

            {/* Source Information */}
            {field.sourceDocumentId && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Source: Document {field.sourceDocumentId}
                  {field.sourcePage && `, Page ${field.sourcePage}`}
                </Typography>
              </Box>
            )}

            {/* Evidence Quote */}
            {field.evidenceQuote && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Evidence from Document:
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'warning.50' }}>
                  <Typography variant="body2" fontStyle="italic">
                    "{field.evidenceQuote}"
                  </Typography>
                </Paper>
              </Box>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Error Display */}
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Corrected Value Input */}
        <TextField
          label="Corrected Value"
          fullWidth
          value={correctedValue}
          onChange={(e) => setCorrectedValue(e.target.value)}
          placeholder={`Enter the correct ${fieldLabel.toLowerCase()}...`}
          disabled={isSubmitting}
          required
          sx={{ mb: 2 }}
          autoFocus
        />

        {/* Correction Note Input */}
        <TextField
          label="Correction Note (Optional)"
          multiline
          rows={3}
          fullWidth
          value={correctionNote}
          onChange={(e) => setCorrectionNote(e.target.value)}
          placeholder="Explain why this correction was made..."
          disabled={isSubmitting}
        />

        {/* Warning if no changes */}
        {!hasChanges && correctedValue && (
          <Alert severity="info" sx={{ mt: 2 }}>
            The corrected value is the same as the original value.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || !correctedValue.trim()}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? 'Saving...' : 'Save Correction'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
