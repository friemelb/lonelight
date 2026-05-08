import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Typography,
  IconButton,
  Skeleton,
  Alert,
  Box,
  Stack,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import type { DocumentChunk } from '@loanlens/domain';

interface ChunkViewerProps {
  open: boolean;
  documentId: string;
  onClose: () => void;
}

export function ChunkViewer({ open, documentId, onClose }: ChunkViewerProps) {
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);
  const [documentFilename, setDocumentFilename] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open && documentId) {
      fetchChunks();
    } else {
      // Reset state when dialog closes
      setChunks([]);
      setError(null);
      setExpandedChunk(null);
      setDocumentFilename('');
      setCopySuccess(null);
    }
  }, [open, documentId]);

  const fetchChunks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, fetch the document to get the filename
      const docResponse = await fetch(`/api/documents/${documentId}`);
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.statusText}`);
      }
      const docData = await docResponse.json();
      setDocumentFilename(docData.filename || 'Unknown Document');

      // Then fetch the chunks
      const response = await fetch(`/api/documents/${documentId}/chunks`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No chunks found for this document');
        }
        throw new Error(`Failed to fetch chunks: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert ISO date strings to Date objects
      const chunksWithDates = data.data.map((chunk: any) => ({
        ...chunk,
        extractedAt: new Date(chunk.extractedAt)
      }));

      setChunks(chunksWithDates);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chunks');
      setIsLoading(false);
      setChunks([]);
    }
  };

  const handleAccordionChange = (chunkId: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedChunk(isExpanded ? chunkId : null);
  };

  const handleCopyChunk = async (content: string, chunkId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(chunkId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="span">
            Document Chunks
          </Typography>
          {documentFilename && (
            <Chip
              label={documentFilename}
              size="small"
              variant="outlined"
              sx={{ maxWidth: 300 }}
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          // Loading skeletons
          <Stack spacing={2}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Box key={index}>
                <Skeleton variant="rectangular" height={60} />
              </Box>
            ))}
          </Stack>
        ) : error ? (
          // Error state
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : chunks.length === 0 ? (
          // Empty state
          <Alert severity="info">
            No chunks found for this document. The document may not have been processed yet.
          </Alert>
        ) : (
          // Chunks list
          <Stack spacing={1}>
            {chunks.map((chunk, index) => (
              <Accordion
                key={chunk.id}
                expanded={expandedChunk === chunk.id}
                onChange={handleAccordionChange(chunk.id)}
                sx={{
                  '&:before': {
                    display: 'none'
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: 'grey.50',
                    '&:hover': {
                      backgroundColor: 'grey.100'
                    }
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Chunk {index + 1}
                    </Typography>
                    <Chip
                      label={`Page ${chunk.pageNumber}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {chunk.content.length} characters
                    </Typography>
                    {chunk.confidence !== undefined && (
                      <Chip
                        label={`${(chunk.confidence * 100).toFixed(0)}% confidence`}
                        size="small"
                        color={chunk.confidence > 0.9 ? 'success' : chunk.confidence > 0.7 ? 'warning' : 'default'}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </AccordionSummary>

                <AccordionDetails>
                  <Stack spacing={2}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: 'grey.50',
                        position: 'relative'
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleCopyChunk(chunk.content, chunk.id)}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>

                      {copySuccess === chunk.id && (
                        <Typography
                          variant="caption"
                          color="success.main"
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 48
                          }}
                        >
                          Copied!
                        </Typography>
                      )}

                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          m: 0,
                          pr: 5
                        }}
                      >
                        {chunk.content}
                      </Typography>
                    </Paper>

                    {/* Additional metadata */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        Chunk Index: {chunk.chunkIndex}
                      </Typography>
                      {chunk.boundingBox && (
                        <Typography variant="caption" color="text.secondary">
                          Position: [{chunk.boundingBox.join(', ')}]
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Extracted: {chunk.extractedAt.toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', ml: 2 }}>
          {chunks.length > 0 && `Total: ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''}`}
        </Typography>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
