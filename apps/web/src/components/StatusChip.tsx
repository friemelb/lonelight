import { Chip } from '@mui/material';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  PlayArrow,
  Psychology,
  Upload,
  Warning
} from '@mui/icons-material';
import type { ProcessingStatus } from '@loanlens/domain';

interface StatusChipProps {
  status: ProcessingStatus;
  size?: 'small' | 'medium';
}

/**
 * Color-coded chip component for displaying document processing status
 */
export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  // Map status to color and icon
  const getStatusConfig = (status: ProcessingStatus) => {
    switch (status) {
      case 'UPLOADED':
        return {
          color: 'default' as const,
          icon: <Upload sx={{ fontSize: 16 }} />,
          label: 'Uploaded'
        };
      case 'QUEUED':
        return {
          color: 'info' as const,
          icon: <HourglassEmpty sx={{ fontSize: 16 }} />,
          label: 'Queued'
        };
      case 'PROCESSING':
        return {
          color: 'primary' as const,
          icon: <PlayArrow sx={{ fontSize: 16 }} />,
          label: 'Processing'
        };
      case 'EXTRACTED':
        return {
          color: 'info' as const,
          icon: <CheckCircle sx={{ fontSize: 16 }} />,
          label: 'Extracted'
        };
      case 'ANALYZING':
        return {
          color: 'secondary' as const,
          icon: <Psychology sx={{ fontSize: 16 }} />,
          label: 'Analyzing'
        };
      case 'COMPLETED':
        return {
          color: 'success' as const,
          icon: <CheckCircle sx={{ fontSize: 16 }} />,
          label: 'Completed'
        };
      case 'FAILED':
        return {
          color: 'warning' as const,
          icon: <Warning sx={{ fontSize: 16 }} />,
          label: 'Failed'
        };
      case 'ERROR':
        return {
          color: 'error' as const,
          icon: <Error sx={{ fontSize: 16 }} />,
          label: 'Error'
        };
      default:
        return {
          color: 'default' as const,
          icon: null,
          label: status
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      {...(config.icon && { icon: config.icon })}
      variant="filled"
    />
  );
}
