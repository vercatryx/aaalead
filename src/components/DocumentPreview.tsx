import React, { useState, useEffect, useRef } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { Document } from '../types/documents';
import { getFileFromR2 } from '../utils/r2Storage';

interface DocumentPreviewProps {
  document: Document & { filePath?: string };
  className?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ document, className = '' }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const isImage = (fileName: string): boolean => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '');
  };

  const isPdf = (fileName: string): boolean => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);

      // Revoke previous URL if it exists
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }

      try {
        let objectUrl: string | null = null;
        const filePath = (document as any).filePath;
        
        console.log('DocumentPreview loading:', {
          id: document.id,
          fileName: document.fileName,
          hasFile: !!document.file,
          fileSize: document.file?.size || 0,
          filePath: filePath || 'none'
        });

        // Check if document has a valid file (not empty blob)
        const file = document.file;
        const hasValidFile = file && file.size > 0;

        // If document has a valid file property (File or Blob), use it directly
        if (hasValidFile && file) {
          objectUrl = URL.createObjectURL(file);
          urlRef.current = objectUrl;
          if (isMounted) {
            setPreviewUrl(objectUrl);
            setIsLoading(false);
          }
          return;
        }

        // If document has a filePath, try to fetch it from R2 or API
        if (filePath && filePath.startsWith('documents/')) {
          try {
            console.log('Loading preview from R2:', filePath);
            let file: Blob;
            
            // Try to get file from R2 directly first
            try {
              file = await getFileFromR2(filePath);
            } catch (r2Error) {
              // Fallback to API endpoint if direct R2 access fails
              console.log('Direct R2 access failed, trying API endpoint:', r2Error);
              const apiUrl = `/api/files/${encodeURIComponent(filePath)}`;
              const response = await fetch(apiUrl);
              if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
              }
              file = await response.blob();
            }
            
            if (file && file.size > 0) {
              objectUrl = URL.createObjectURL(file);
              urlRef.current = objectUrl;
              if (isMounted) {
                setPreviewUrl(objectUrl);
              }
            } else {
              throw new Error('File loaded but is empty');
            }
          } catch (err: any) {
            console.error('Failed to load file:', err);
            if (isMounted) {
              setError(`Failed to load preview: ${err.message || 'Unknown error'}`);
            }
          }
        } else {
          if (isMounted) {
            setError('No file available for preview');
          }
        }
      } catch (err: any) {
        console.error('Error creating preview:', err);
        if (isMounted) {
          setError('Failed to create preview');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPreview();

    // Cleanup: revoke object URL when component unmounts or document changes
    return () => {
      isMounted = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [document.id, document.file, (document as any).filePath]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded ${className}`} style={{ minHeight: '200px' }}>
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error || !previewUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 rounded p-4 ${className}`} style={{ minHeight: '200px' }}>
        <FileText className="text-slate-400 mb-2" size={32} />
        <span className="text-xs text-slate-500">{document.fileName}</span>
        {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
      </div>
    );
  }

  if (isImage(document.fileName)) {
    return (
      <div className={`bg-slate-100 rounded overflow-hidden ${className}`} style={{ minHeight: '200px' }}>
        <img
          src={previewUrl}
          alt={document.fileName}
          className="w-full h-full object-contain"
          style={{ maxHeight: '400px' }}
          onError={() => setError('Failed to load image')}
        />
      </div>
    );
  }

  if (isPdf(document.fileName)) {
    return (
      <div className={`bg-slate-100 rounded overflow-hidden ${className}`} style={{ minHeight: '200px' }}>
        <iframe
          src={previewUrl}
          title={document.fileName}
          className="w-full"
          style={{ minHeight: '400px', border: 'none' }}
          onError={() => setError('Failed to load PDF')}
        />
      </div>
    );
  }

  // For other file types, show a placeholder
  return (
    <div className={`flex flex-col items-center justify-center bg-slate-100 rounded p-4 ${className}`} style={{ minHeight: '200px' }}>
      <FileText className="text-slate-400 mb-2" size={32} />
      <span className="text-xs text-slate-500">{document.fileName}</span>
      <span className="text-xs text-slate-400 mt-1">Preview not available</span>
    </div>
  );
};
