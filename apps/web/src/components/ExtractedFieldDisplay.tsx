import {
  Box,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Stack,
  Paper
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  Article,
  Edit
} from '@mui/icons-material';
import type { ExtractedField } from '@loanlens/domain';

interface ExtractedFieldDisplayProps {
  label: string;
  field: ExtractedField<any> | undefined;
  onViewSource?: (documentId: string, page: number) => void;
  onEdit?: () => void;
  canEdit?: boolean;
}

/**
 * Display an extracted field with confidence indicator, source document link,
 * and evidence quote
 */
export function ExtractedFieldDisplay({
  label,
  field,
  onViewSource,
  onEdit,
  canEdit = false
}: ExtractedFieldDisplayProps) {
  if (!field) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body1" color="text.disabled" fontStyle="italic">
          Not available
        </Typography>
      </Box>
    );
  }

  // Determine confidence level and color
  const getConfidenceConfig = (confidence: number) => {
    if (confidence > 0.8) {
      return {
        color: 'success' as const,
        label: 'High',
        icon: <CheckCircle sx={{ fontSize: 14 }} />
      };
    } else if (confidence > 0.6) {
      return {
        color: 'warning' as const,
        label: 'Medium',
        icon: <Warning sx={{ fontSize: 14 }} />
      };
    } else {
      return {
        color: 'error' as const,
        label: 'Low',
        icon: <ErrorIcon sx={{ fontSize: 14 }} />
      };
    }
  };

  const confidenceConfig = getConfidenceConfig(field.confidence);
  const confidencePercent = (field.confidence * 100).toFixed(0);

  return (
    <Box sx={{ py: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Chip
          label={`${confidencePercent}%`}
          color={confidenceConfig.color}
          size="small"
          icon={confidenceConfig.icon}
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
        {field.notes && (
          <Tooltip title={field.notes}>
            <Info sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        )}
        {canEdit && onEdit && (
          <Tooltip title={`Edit ${label}`}>
            <IconButton
              size="small"
              onClick={onEdit}
              sx={{ p: 0.25, ml: 0.5 }}
            >
              <Edit sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
        {String(field.value)}
      </Typography>

      {/* Source information */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">
          Source:
        </Typography>
        {onViewSource ? (
          <Tooltip title="View source document">
            <IconButton
              size="small"
              onClick={() => onViewSource(field.sourceDocumentId, field.sourcePage)}
              sx={{ p: 0.25 }}
            >
              <Article sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.secondary">
            <Article sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
            {field.sourceDocumentId.substring(0, 8)}... (p.{field.sourcePage})
          </Typography>
        )}

        {/* Evidence quote in tooltip */}
        {field.evidenceQuote && (
          <Tooltip
            title={
              <Paper sx={{ p: 1, maxWidth: 400 }}>
                <Typography variant="caption" component="div" sx={{ fontStyle: 'italic' }}>
                  "{field.evidenceQuote}"
                </Typography>
              </Paper>
            }
            arrow
          >
            <Chip
              label="View Evidence"
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }}
            />
          </Tooltip>
        )}

        {field.extractedAt && (
          <Typography variant="caption" color="text.disabled">
            • Extracted {field.extractedAt.toLocaleDateString()}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
