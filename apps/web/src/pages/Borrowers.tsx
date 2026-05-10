import { useEffect, useState, useMemo } from 'react';
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
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Button
} from '@mui/material';
import {
  Refresh,
  Search,
  Person,
  CheckCircle,
  Cancel,
  Edit,
  PendingActions,
  RestartAlt
} from '@mui/icons-material';
import {
  useBorrowerStore,
  DEFAULT_FILTERS,
  type SearchToken
} from '../store/borrowerStore';
import { useDocumentStore } from '../store/documentStore';
import { ReviewStatus } from '@loanlens/domain';

export function Borrowers() {
  const navigate = useNavigate();
  const {
    borrowers,
    pagination,
    filters,
    isLoading,
    error,
    fetchFiltered,
    setFilters,
    resetFilters,
    clearError
  } = useBorrowerStore();

  const { documents, fetchDocuments } = useDocumentStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchInput, setSearchInput] = useState(filters.q);

  // Initial fetch + load documents for the source-document filter.
  useEffect(() => {
    fetchFiltered(rowsPerPage, 0);
    if (documents.length === 0) {
      fetchDocuments({}, 200, 0);
    }
  }, []);

  // Debounce the free-text search so we don't hammer the API on every keystroke.
  useEffect(() => {
    if (searchInput === filters.q) return;
    const timer = setTimeout(() => {
      setPage(0);
      setFilters({ q: searchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    fetchFiltered(rowsPerPage, newPage * rowsPerPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    fetchFiltered(newRowsPerPage, 0);
  };

  const handleRefresh = () => {
    fetchFiltered(rowsPerPage, page * rowsPerPage);
  };

  const handleRowClick = (borrowerId: string) => {
    navigate(`/borrowers/${borrowerId}`);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setPage(0);
    resetFilters();
  };

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

  const filtersAreDefault = useMemo(
    () =>
      filters.q === DEFAULT_FILTERS.q &&
      filters.minConfidence === DEFAULT_FILTERS.minConfidence &&
      filters.reviewStatus === DEFAULT_FILTERS.reviewStatus &&
      filters.sourceDocumentId === DEFAULT_FILTERS.sourceDocumentId &&
      filters.searchIn.length === 0,
    [filters]
  );

  // Human-readable labels for the field-name tokens used by `?in=`.
  const SEARCH_IN_OPTIONS: Array<{ value: SearchToken; label: string }> = [
    { value: 'fullName', label: 'Full name' },
    { value: 'firstName', label: 'First name' },
    { value: 'middleName', label: 'Middle name' },
    { value: 'lastName', label: 'Last name' },
    { value: 'ssn', label: 'SSN' },
    { value: 'dateOfBirth', label: 'Date of birth' },
    { value: 'email', label: 'Email' },
    { value: 'phoneNumber', label: 'Phone' },
    { value: 'alternatePhoneNumber', label: 'Alternate phone' },
    { value: 'currentAddress', label: 'Current address' },
    { value: 'previousAddresses', label: 'Previous addresses' },
    { value: 'accountNumbers', label: 'Account numbers' },
    { value: 'loanNumbers', label: 'Loan numbers' },
    { value: 'incomeHistory', label: 'Income history' },
    { value: 'evidenceQuote', label: 'Evidence quotes' }
  ];

  const selectedSearchInOptions = useMemo(
    () =>
      filters.searchIn
        .map((t) => SEARCH_IN_OPTIONS.find((o) => o.value === t))
        .filter((o): o is { value: SearchToken; label: string } => Boolean(o)),
    [filters.searchIn]
  );

  const handleSearchInChange = (
    _event: React.SyntheticEvent,
    next: Array<{ value: SearchToken; label: string }>
  ) => {
    setPage(0);
    setFilters({ searchIn: next.map((o) => o.value) });
  };

  const documentOptions = useMemo(
    () => [
      { id: 'ALL', filename: 'All documents' },
      ...documents.map((d) => ({ id: d.id, filename: d.filename }))
    ],
    [documents]
  );

  const selectedDocOption =
    documentOptions.find((d) => d.id === filters.sourceDocumentId) ?? documentOptions[0];

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Borrowers</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search borrowers..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 250 }}
          />
          <Autocomplete
            multiple
            size="small"
            sx={{ minWidth: 280, maxWidth: 420 }}
            options={SEARCH_IN_OPTIONS}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(o, v) => o.value === v.value}
            value={selectedSearchInOptions}
            onChange={handleSearchInChange}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search in"
                placeholder={
                  filters.searchIn.length === 0 ? 'All field values' : ''
                }
              />
            )}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <Box sx={{ minWidth: 220, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Min confidence (fullName): {filters.minConfidence.toFixed(2)}
            </Typography>
            <Slider
              value={filters.minConfidence}
              onChange={(_e, value) => {
                setPage(0);
                setFilters({ minConfidence: value as number });
              }}
              min={0}
              max={1}
              step={0.05}
              marks={[
                { value: 0, label: '0' },
                { value: 0.5, label: '0.5' },
                { value: 1, label: '1' }
              ]}
              size="small"
            />
          </Box>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="review-status-label">Review status</InputLabel>
            <Select
              labelId="review-status-label"
              label="Review status"
              value={filters.reviewStatus}
              onChange={(e) => {
                setPage(0);
                setFilters({
                  reviewStatus: e.target.value as ReviewStatus | 'ALL'
                });
              }}
            >
              <MenuItem value="ALL">All statuses</MenuItem>
              <MenuItem value={ReviewStatus.PENDING_REVIEW}>Pending</MenuItem>
              <MenuItem value={ReviewStatus.APPROVED}>Approved</MenuItem>
              <MenuItem value={ReviewStatus.REJECTED}>Rejected</MenuItem>
              <MenuItem value={ReviewStatus.CORRECTED}>Corrected</MenuItem>
            </Select>
          </FormControl>

          <Autocomplete
            size="small"
            sx={{ minWidth: 260, flex: 1 }}
            options={documentOptions}
            getOptionLabel={(option) => option.filename}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={selectedDocOption}
            onChange={(_e, value) => {
              setPage(0);
              setFilters({ sourceDocumentId: value?.id ?? 'ALL' });
            }}
            renderInput={(params) => (
              <TextField {...params} label="Source document" />
            )}
          />

          <Button
            startIcon={<RestartAlt />}
            disabled={filtersAreDefault || isLoading}
            onClick={handleResetFilters}
          >
            Reset
          </Button>
        </Stack>
      </Paper>

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
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {filtersAreDefault
                      ? 'No borrowers found'
                      : 'No borrowers match your search and filters'}
                  </Typography>
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
                  <TableCell>{borrower.updatedAt.toLocaleDateString()}</TableCell>
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
