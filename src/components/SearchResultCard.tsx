import { useState } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import {
  FileTextIcon,
  CopyIcon,
  CaretDownIcon,
  CaretUpIcon,
  ImageIcon
} from "@phosphor-icons/react";

interface SearchResultCardProps {
  result: {
    id: string;
    text: string;
    source: string;
    overallScore: number;
    vectorScore: number;
    keywordScore: number;
  };
  index: number;
}

// Extract title from markdown content
function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Check if content contains images
function hasImages(content: string): boolean {
  return /!\[.*?\]\(.*?\)/.test(content);
}

// Count images in content
function countImages(content: string): number {
  const matches = content.match(/!\[.*?\]\(.*?\)/g);
  return matches ? matches.length : 0;
}

// Extract first paragraph for preview (excluding headings)
function extractPreview(content: string, maxLength: number = 280): string {
  // Remove markdown images
  const withoutImages = content.replace(/!\[.*?\]\(.*?\)/g, "");
  // Remove headings
  const withoutHeadings = withoutImages.replace(/^#+\s+.+$/gm, "");
  // Remove code blocks
  const withoutCode = withoutHeadings.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  const withoutInlineCode = withoutCode.replace(/`[^`]+`/g, "");
  // Clean up extra whitespace
  const cleaned = withoutInlineCode.replace(/\n{2,}/g, "\n").trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + "...";
}

// Format source name
function formatSource(source: string): string {
  // Remove file extensions and ID prefixes
  return source
    .replace(/\.(md|txt)$/i, "")
    .replace(/^(note|journal|article|goal|health)-\d+-/, "")
    .replace(/-/g, " ");
}

// Extract timestamp from source if available
function extractTimestamp(source: string): string | null {
  const match = source.match(/(\d{13})/);
  if (match) {
    const timestamp = parseInt(match[1], 10);
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  return null;
}

export function SearchResultCard({ result, index }: SearchResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = extractTitle(result.text);
  const sourceName = formatSource(result.source);
  const timestamp = extractTimestamp(result.source);
  const imageCount = countImages(result.text);
  const preview = extractPreview(result.text);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="search-result-card animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="search-result-header">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileTextIcon size={16} className="text-[var(--text-tertiary)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)] truncate">
                {sourceName}
              </span>
              {timestamp && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  • {timestamp}
                </span>
              )}
            </div>
            {title && (
              <h3 className="text-lg font-semibold text-[var(--text-primary)] leading-tight">
                {title}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {imageCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-tertiary)] rounded-md text-xs text-[var(--text-secondary)]">
                <ImageIcon size={12} />
                <span>
                  {imageCount} image{imageCount > 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div className="score-badge">
              {(result.overallScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Score details tooltip area */}
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
          <span>Match score</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Vector: {(result.vectorScore * 100).toFixed(0)}%
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Keyword: {(result.keywordScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="search-result-content">
        {isExpanded ? (
          <div className="prose prose-sm max-w-none">
            <Streamdown
              className="sd-theme"
              plugins={{ code }}
              controls={false}
              isAnimating={false}
            >
              {result.text}
            </Streamdown>
          </div>
        ) : (
          <div className="text-[var(--text-secondary)] leading-relaxed">
            {preview || (
              <span className="text-[var(--text-tertiary)] italic">
                No preview available
              </span>
            )}
          </div>
        )}

        {/* Image indicator when not expanded */}
        {!isExpanded && imageCount > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-md">
            <ImageIcon size={16} className="text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)]">
              {imageCount} image{imageCount > 1 ? "s" : ""} in document
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              (expand to view)
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="search-result-footer">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="search-result-action"
        >
          {isExpanded ? (
            <>
              <CaretUpIcon size={16} />
              Show less
            </>
          ) : (
            <>
              <CaretDownIcon size={16} />
              Show full content
            </>
          )}
        </button>

        <button
          onClick={handleCopy}
          className="search-result-action"
          title="Copy to clipboard"
        >
          <CopyIcon size={16} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
