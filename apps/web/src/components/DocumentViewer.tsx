import { Box, Paper, Typography, Chip, Divider } from '@mui/material';
import { DocumentRecord, DocumentChunk } from '@loanlens/domain';

interface DocumentViewerProps {
  document: DocumentRecord;
  chunks: DocumentChunk[];
  highlightPage?: number;
  evidenceQuote?: string;
}

export function DocumentViewer({
  document,
  chunks,
  highlightPage,
  evidenceQuote
}: DocumentViewerProps) {
  // Filter chunks by page if highlightPage is specified
  const displayChunks = highlightPage
    ? chunks.filter((chunk) => chunk.pageNumber === highlightPage)
    : chunks;

  // Helper function to highlight evidence in text
  const highlightText = (text: string, evidence?: string) => {
    if (!evidence) return text;

    const lowerText = text.toLowerCase();
    const lowerEvidence = evidence.toLowerCase();
    const index = lowerText.indexOf(lowerEvidence);

    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <Box
          component="span"
          sx={{
            bgcolor: 'warning.light',
            px: 0.5,
            borderRadius: 0.5,
            fontWeight: 'bold'
          }}
        >
          {text.substring(index, index + evidence.length)}
        </Box>
        {text.substring(index + evidence.length)}
      </>
    );
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {document.filename}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Status: ${document.status}`} size="small" />
          <Chip label={`Size: ${(document.fileSize / 1024).toFixed(1)} KB`} size="small" />
          {document.pageCount && (
            <Chip label={`${document.pageCount} pages`} size="small" />
          )}
          {highlightPage && (
            <Chip
              label={`Viewing page ${highlightPage}`}
              color="primary"
              size="small"
            />
          )}
          <Chip
            label={`${displayChunks.length} chunk${displayChunks.length !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>

      {evidenceQuote && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Evidence Quote:
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            "{evidenceQuote}"
          </Typography>
        </Box>
      )}

      {displayChunks.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          {displayChunks.map((chunk, index) => (
            <Box key={chunk.id} sx={{ mb: 2 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`Page ${chunk.pageNumber}`}
                    size="small"
                    color={
                      highlightPage && chunk.pageNumber === highlightPage
                        ? 'primary'
                        : 'default'
                    }
                  />
                  <Chip label={`Chunk ${chunk.chunkIndex + 1}`} size="small" variant="outlined" />
                  {chunk.confidence && (
                    <Chip
                      label={`Confidence: ${(chunk.confidence * 100).toFixed(0)}%`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    lineHeight: 1.6
                  }}
                >
                  {highlightText(chunk.content, evidenceQuote)}
                </Typography>
              </Box>
              {index < displayChunks.length - 1 && <Divider sx={{ my: 2 }} />}
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            p: 3,
            bgcolor: 'background.default',
            borderRadius: 1,
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No document chunks found
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Storage Path: {document.storagePath}
        </Typography>
        {document.uploadedAt && (
          <Typography variant="body2" color="text.secondary">
            Uploaded: {new Date(document.uploadedAt).toLocaleString()}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
