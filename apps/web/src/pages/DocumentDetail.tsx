import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Breadcrumbs,
  Link
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { DocumentRecord, DocumentChunk } from '@loanlens/domain';
import { DocumentViewer } from '@/components/DocumentViewer';

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get optional query parameters
  const highlightPage = searchParams.get('page')
    ? parseInt(searchParams.get('page')!, 10)
    : undefined;
  const evidenceQuote = searchParams.get('evidence') || undefined;

  useEffect(() => {
    const fetchDocumentAndChunks = async () => {
      if (!id) {
        setError('Document ID is required');
        setLoading(false);
        return;
      }

      try {
        // Fetch document details
        const docResponse = await fetch(`/api/documents/${id}`);

        if (!docResponse.ok) {
          if (docResponse.status === 404) {
            throw new Error('Document not found');
          }
          throw new Error('Failed to fetch document');
        }

        const docData = await docResponse.json();
        setDocument(docData);

        // Fetch document chunks
        const chunksResponse = await fetch(`/api/documents/${id}/chunks`);

        if (chunksResponse.ok) {
          const chunksData = await chunksResponse.json();
          setChunks(chunksData.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentAndChunks();
  }, [id]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/documents')}
        >
          Back to Documents
        </Button>
      </Box>
    );
  }

  if (!document) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Document not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Dashboard
        </Link>
        <Link
          underline="hover"
          color="inherit"
          sx={{ cursor: 'pointer' }}
          onClick={() => navigate('/documents')}
        >
          Documents
        </Link>
        <Typography color="text.primary">{document.filename}</Typography>
      </Breadcrumbs>

      {/* Back Button */}
      <Button
        variant="outlined"
        startIcon={<ArrowBack />}
        onClick={() => navigate(-1)}
        sx={{ mb: 3 }}
      >
        Back
      </Button>

      {/* Document Viewer */}
      <DocumentViewer
        document={document}
        chunks={chunks}
        highlightPage={highlightPage}
        evidenceQuote={evidenceQuote}
      />
    </Box>
  );
}
