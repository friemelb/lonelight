import { useEffect, useState } from 'react';
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
  TablePagination,
  Skeleton,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Chip,
  Button
} from '@mui/material';
import { Refresh, Search, Person, CheckCircle, Cancel, Edit, PendingActions, AutoAwesome } from '@mui/icons-material';
import { useBorrowerStore } from '../store/borrowerStore';
import { ReviewStatus } from '@loanlens/domain';

export function Borrowers() {
  const navigate = useNavigate();
  const {
    borrowers,
    pagination,
    searchQuery,
    isLoading,
    isExtracting,
    error,
    fetchBorrowers,
    clearError,
    extractBorrowers
  } = useBorrowerStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Initial fetch
  useEffect(() => {
    fetchBorrowers('', rowsPerPage, 0);
  }, []);

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        setPage(0);
        fetchBorrowers(localSearchQuery, rowsPerPage, 0);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    fetchBorrowers(searchQuery, rowsPerPage, newPage * rowsPerPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    fetchBorrowers(searchQuery, newRowsPerPage, 0);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchBorrowers(searchQuery, rowsPerPage, page * rowsPerPage);
  };

  // Handle row click - navigate to detail page
  const handleRowClick = (borrowerId: string) => {
    navigate(`/borrowers/${borrowerId}`);
  };

  // Get display name from borrower
  const getDisplayName = (borrower: any) => {
    if (borrower.fullName?.value) {
      return borrower.fullName.value;
    }
    const first = borrower.firstName?.value || '';
    const last = borrower.lastName?.value || '';
    if (first && last) {
      return `${first} ${last}`;
    }
    return first || last || '—';
  };

  // Get review status display info
  const getReviewStatusInfo = (status: ReviewStatus) => {
    switch (status) {
      case ReviewStatus.APPROVED:
        return { color: 'success' as const, icon: <CheckCircle />, label: 'Approved' };
      case ReviewStatus.REJECTED:
        return { color: 'error' as const, icon: <Cancel />, label: 'Rejected' };
      case ReviewStatus.CORRECTED:
        return { color: 'warning' as const, icon: <Edit />, label: 'Corrected' };
      case ReviewStatus.PENDING_REVIEW:
      default:
        return { color: 'default' as const, icon: <PendingActions />, label: 'Pending' };
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">
          Borrowers
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder="Search borrowers..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
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
              <TableCell>Full Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="center"># Documents</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: rowsPerPage }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton width={50} /></TableCell>
                </TableRow>
              ))
            ) : borrowers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                    {localSearchQuery ? (
                      <Typography variant="body2" color="text.secondary">
                        No borrowers match &ldquo;{localSearchQuery}&rdquo;.
                      </Typography>
                    ) : (
                      <>
                        <Typography variant="body1" color="text.secondary">
                          No borrowers extracted yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Run extraction to pull borrower data from ingested documents.
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AutoAwesome />}
                          disabled={isExtracting}
                          onClick={async () => {
                            try {
                              await extractBorrowers();
                            } catch {
                              /* error already surfaced via store */
                            }
                          }}
                        >
                          {isExtracting ? 'Running extraction…' : 'Run Extraction'}
                        </Button>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              borrowers.map((borrower) => (
                <TableRow
                  key={borrower.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(borrower.id)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Person fontSize="small" color="action" />
                      <Typography variant="body2">
                        {getDisplayName(borrower)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {borrower.email?.value || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {borrower.phoneNumber?.value || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getReviewStatusInfo(borrower.reviewStatus).icon}
                      label={getReviewStatusInfo(borrower.reviewStatus).label}
                      color={getReviewStatusInfo(borrower.reviewStatus).color}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {borrower.updatedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={borrower.documentIds.length}
                      size="small"
                      color={borrower.documentIds.length > 0 ? 'primary' : 'default'}
                    />
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
    </Box>
  );
}
