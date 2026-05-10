import { useEffect, useState } from 'react';
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
  TablePagination,
  Skeleton,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid
} from '@mui/material';
import { Refresh, Visibility, CloudUpload, ViewModule } from '@mui/icons-material';
import { ProcessingStatus } from '@loanlens/domain';
import { useDocumentStore } from '../store/documentStore';
import { StatusChip } from '../components/StatusChip';
import { ChunkViewer } from '../components/ChunkViewer';

export function Documents() {
  const {
    documents,
    pagination,
    filters,
    isLoading,
    error,
    fetchDocuments,
    setFilters,
    clearError,
    ingestDocuments
  } = useDocumentStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ingestionDialogOpen, setIngestionDialogOpen] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{filename: string; error: string}>;
  } | null>(null);
  const [chunkViewerOpen, setChunkViewerOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchDocuments({}, rowsPerPage, 0);
  }, []);

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    fetchDocuments(filters, rowsPerPage, newPage * rowsPerPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    fetchDocuments(filters, newRowsPerPage, 0);
  };

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    setPage(0);
    if (status === 'ALL') {
      setFilters({});
    } else {
      setFilters({ ...filters, status: status as ProcessingStatus });
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchDocuments(filters, rowsPerPage, page * rowsPerPage);
  };

  // Handle ingestion
  const handleIngestion = async () => {
    try {
      const result = await ingestDocuments();
      setIngestionResult(result);
      setIngestionDialogOpen(true);
    } catch (error) {
      // Error already set in store
      console.error('Ingestion failed:', error);
    }
  };

  // Handle row click
  const handleRowClick = (doc: any) => {
    setSelectedDoc(doc);
    setDialogOpen(true);
  };

  // Handle viewing chunks
  const handleViewChunks = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setChunkViewerOpen(true);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">
          Documents
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={filters.status || 'ALL'}
              label="Status Filter"
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value={ProcessingStatus.UPLOADED}>Uploaded</MenuItem>
              <MenuItem value={ProcessingStatus.QUEUED}>Queued</MenuItem>
              <MenuItem value={ProcessingStatus.PROCESSING}>Processing</MenuItem>
              <MenuItem value={ProcessingStatus.EXTRACTED}>Extracted</MenuItem>
              <MenuItem value={ProcessingStatus.ANALYZING}>Analyzing</MenuItem>
              <MenuItem value={ProcessingStatus.COMPLETED}>Completed</MenuItem>
              <MenuItem value={ProcessingStatus.FAILED}>Failed</MenuItem>
              <MenuItem value={ProcessingStatus.ERROR}>Error</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<CloudUpload />}
            onClick={handleIngestion}
            disabled={isLoading}
          >
            {isLoading ? 'Running…' : 'Run Ingestion'}
          </Button>
          <Tooltip title="Refresh document list">
            <IconButton onClick={handleRefresh} disabled={isLoading} aria-label="Refresh document list">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>Pages</TableCell>
              <TableCell align="right">Chunks</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: rowsPerPage }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton width={50} /></TableCell>
                  <TableCell><Skeleton width={50} /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                </TableRow>
              ))
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No documents yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Drop files into <code>apps/api/data/corpus/</code> and click
                      <strong> Run Ingestion</strong> to scan and parse them.
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUpload />}
                      onClick={handleIngestion}
                      disabled={isLoading}
                    >
                      Run Ingestion
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(doc)}
                >
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                      {doc.filename}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={doc.status} />
                  </TableCell>
                  <TableCell align="right">
                    {formatFileSize(doc.fileSize)}
                  </TableCell>
                  <TableCell>
                    {doc.uploadedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {doc.pageCount || '—'}
                  </TableCell>
                  <TableCell align="right">
                    {doc.pageCount ? '—' : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(doc);
                      }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View chunks">
                      <IconButton
                        size="small"
                        disabled={!doc.pageCount || doc.pageCount === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewChunks(doc.id);
                        }}
                      >
                        <ViewModule fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {pagination && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={pagination.total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </TableContainer>

      {/* Document Detail Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedDoc && (
          <>
            <DialogTitle>
              Document Details
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Filename
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedDoc.filename}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={selectedDoc.status} size="medium" />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    File Size
                  </Typography>
                  <Typography variant="body1">
                    {formatFileSize(selectedDoc.fileSize)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Uploaded
                  </Typography>
                  <Typography variant="body1">
                    {selectedDoc.uploadedAt.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Updated
                  </Typography>
                  <Typography variant="body1">
                    {selectedDoc.updatedAt.toLocaleString()}
                  </Typography>
                </Grid>
                {selectedDoc.pageCount && (
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Pages
                    </Typography>
                    <Typography variant="body1">
                      {selectedDoc.pageCount}
                    </Typography>
                  </Grid>
                )}
                {selectedDoc.borrowerId && (
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Borrower ID
                    </Typography>
                    <Typography variant="body1">
                      {selectedDoc.borrowerId}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Document ID
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {selectedDoc.id}
                  </Typography>
                </Grid>
                {selectedDoc.errorMessage && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      {selectedDoc.errorMessage}
                    </Alert>
                  </Grid>
                )}
                {selectedDoc.metadata && Object.keys(selectedDoc.metadata).length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Metadata
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
                      <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                        {JSON.stringify(selectedDoc.metadata, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Ingestion Results Dialog */}
      <Dialog
        open={ingestionDialogOpen}
        onClose={() => setIngestionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Ingestion Complete
        </DialogTitle>
        <DialogContent>
          {ingestionResult && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Total files processed: <strong>{ingestionResult.total}</strong>
              </Typography>
              <Typography variant="body1" gutterBottom color="success.main">
                Successful: <strong>{ingestionResult.successful}</strong>
              </Typography>
              {ingestionResult.failed > 0 && (
                <>
                  <Typography variant="body1" gutterBottom color="error.main">
                    Failed: <strong>{ingestionResult.failed}</strong>
                  </Typography>
                  {ingestionResult.errors.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Errors:
                      </Typography>
                      {ingestionResult.errors.map((err, idx) => (
                        <Alert severity="warning" key={idx} sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            <strong>{err.filename}</strong>: {err.error}
                          </Typography>
                        </Alert>
                      ))}
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIngestionDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Chunk Viewer Dialog */}
      <ChunkViewer
        open={chunkViewerOpen}
        documentId={selectedDocumentId || ''}
        onClose={() => {
          setChunkViewerOpen(false);
          setSelectedDocumentId(null);
        }}
      />
    </Box>
  );
}
