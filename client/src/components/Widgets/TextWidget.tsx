import React from 'react';
import { Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TextConfig } from '../../types';

interface Props {
  config: TextConfig;
}

export default function TextWidget({ config }: Props) {
  return (
    <Box sx={{
      height: '100%', overflow: 'auto', px: 1, fontSize: 14,
      '& h1,& h2,& h3': { mt: 1, mb: 0.5 },
      '& p': { my: 0.5 },
      '& ul,& ol': { my: 0.5, pl: 3 },
      '& code': { fontFamily: 'monospace', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, fontSize: '0.9em' },
      '& pre': { bgcolor: 'action.hover', p: 1, borderRadius: 1, overflow: 'auto' },
      '& blockquote': { borderLeft: 3, borderColor: 'divider', pl: 1.5, color: 'text.secondary' },
      '& table': { borderCollapse: 'collapse' },
      '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.4, fontSize: 12 },
      '& a': { color: 'primary.main' },
      '& img': { maxWidth: '100%' },
    }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{config.content || ''}</ReactMarkdown>
    </Box>
  );
}
