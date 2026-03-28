'use client';

import { useState, useCallback } from 'react';
import {
  Input,
  Button,
  Switch,
  Space,
  Typography,
  Progress,
  Alert,
  Modal,
  Divider,
  Badge,
  Tooltip,
  Empty,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  SwapOutlined,
  DownOutlined,
  RightOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useSearchReplace } from '../hooks/useSearchReplace';
import { NoteMatchGroupItem } from './NoteMatchGroupItem';

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SearchReplacePanel — main UI for workspace-level search & replace.
 *
 * Can be used as a sidebar panel or modal content.
 * Follows Ant Design conventions and FSD architecture.
 */
export function SearchReplacePanel() {
  const {
    query,
    replacement,
    mode,
    caseSensitive,
    wholeWord,
    matchesByNote,
    totalMatches,
    notesAffected,
    truncated,
    isSearching,
    searchError,
    isReplacing,
    replaceProgress,
    replaceError,
    excludedMatchIds,
    isReplaceExpanded,
    includedCount,

    setQuery,
    setReplacement,
    setMode,
    setCaseSensitive,
    setWholeWord,
    toggleMatchExclusion,
    excludeAllMatchesForNote,
    includeAllMatchesForNote,
    setReplaceExpanded,

    performSearch,
    replaceSingle,
    replaceAll,
  } = useSearchReplace();

  const [confirmVisible, setConfirmVisible] = useState(false);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      performSearch(e.target.value);
    },
    [setQuery, performSearch],
  );

  const handleReplacementChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReplacement(e.target.value);
    },
    [setReplacement],
  );

  const handleSearchSubmit = useCallback(() => {
    performSearch();
  }, [performSearch]);

  const handleToggleRegex = useCallback(
    (checked: boolean) => {
      setMode(checked ? 'regex' : 'plain');
    },
    [setMode],
  );

  const handleToggleCaseSensitive = useCallback(
    (checked: boolean) => {
      setCaseSensitive(checked);
    },
    [setCaseSensitive],
  );

  const handleToggleWholeWord = useCallback(
    (checked: boolean) => {
      setWholeWord(checked);
    },
    [setWholeWord],
  );

  const handleToggleReplace = useCallback(() => {
    setReplaceExpanded(!isReplaceExpanded);
  }, [isReplaceExpanded, setReplaceExpanded]);

  const handleReplaceAllClick = useCallback(() => {
    if (includedCount > 10) {
      setConfirmVisible(true);
    } else {
      void replaceAll();
    }
  }, [includedCount, replaceAll]);

  const handleConfirmReplaceAll = useCallback(async () => {
    setConfirmVisible(false);
    await replaceAll();
  }, [replaceAll]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px 8px' }}>
        <Title level={5} style={{ margin: 0, fontSize: 14 }}>
          Search & Replace
        </Title>
      </div>

      {/* Search input */}
      <div style={{ padding: '0 16px 8px' }}>
        <Input
          placeholder="Search across all notes..."
          value={query}
          onChange={handleQueryChange}
          onPressEnter={handleSearchSubmit}
          prefix={<SearchOutlined />}
          suffix={isSearching ? <Spin size="small" /> : null}
          allowClear
          autoFocus
        />
      </div>

      {/* Mode toggles */}
      <div style={{ padding: '0 16px 8px' }}>
        <Space size={16} wrap>
          <Tooltip title="Regular expression mode">
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>Regex</Text>
              <Switch size="small" checked={mode === 'regex'} onChange={handleToggleRegex} />
            </Space>
          </Tooltip>

          <Tooltip title="Match case exactly">
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>Aa</Text>
              <Switch size="small" checked={caseSensitive} onChange={handleToggleCaseSensitive} />
            </Space>
          </Tooltip>

          <Tooltip title="Match whole words only">
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>Word</Text>
              <Switch size="small" checked={wholeWord} onChange={handleToggleWholeWord} />
            </Space>
          </Tooltip>
        </Space>
      </div>

      {/* Replace section (expandable) */}
      <div style={{ padding: '0 16px 8px' }}>
        <Button
          type="text"
          size="small"
          icon={isReplaceExpanded ? <DownOutlined /> : <RightOutlined />}
          onClick={handleToggleReplace}
          style={{ fontSize: 12, paddingLeft: 0 }}
        >
          Replace
        </Button>

        {isReplaceExpanded && (
          <div style={{ marginTop: 4 }}>
            <Input
              placeholder="Replace with..."
              value={replacement}
              onChange={handleReplacementChange}
              prefix={<SwapOutlined />}
              allowClear
            />

            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                size="small"
                disabled={includedCount === 0 || isReplacing || !replacement}
                loading={isReplacing}
                onClick={handleReplaceAllClick}
              >
                Replace All ({includedCount})
              </Button>
            </div>
          </div>
        )}
      </div>

      <Divider style={{ margin: '0 0 8px' }} />

      {/* Status bar */}
      <div style={{ padding: '0 16px 8px' }}>
        {searchError && (
          <Alert type="error" message={searchError} showIcon closable style={{ marginBottom: 8 }} />
        )}

        {replaceError && (
          <Alert
            type="error"
            message={replaceError}
            showIcon
            closable
            style={{ marginBottom: 8 }}
          />
        )}

        {isReplacing && replaceProgress > 0 && (
          <Progress
            percent={replaceProgress}
            size="small"
            status="active"
            style={{ marginBottom: 8 }}
          />
        )}

        {totalMatches > 0 && (
          <Space size={8}>
            <Badge
              count={totalMatches}
              showZero
              style={{ backgroundColor: 'var(--ant-color-primary, #1677ff)' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              match{totalMatches !== 1 ? 'es' : ''} in {notesAffected} note
              {notesAffected !== 1 ? 's' : ''}
            </Text>
            {truncated && (
              <Tooltip title="Results were truncated. Narrow your search to see all matches.">
                <InfoCircleOutlined
                  style={{ color: 'var(--ant-color-warning, #faad14)', fontSize: 14 }}
                />
              </Tooltip>
            )}
          </Space>
        )}

        {!isSearching && query.trim() && totalMatches === 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No matches found
          </Text>
        )}
      </div>

      {/* Results list (virtual-scroll-ready container) */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 0 8px',
        }}
      >
        {matchesByNote.length === 0 && !isSearching && !query.trim() && (
          <Empty
            description="Enter a search query to find matches across all notes"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 48 }}
          />
        )}

        {matchesByNote.map((group) => (
          <NoteMatchGroupItem
            key={group.noteId}
            group={group}
            replacementText={replacement}
            excludedMatchIds={excludedMatchIds}
            isReplacing={isReplacing}
            onToggleExclusion={toggleMatchExclusion}
            onExcludeAllForNote={excludeAllMatchesForNote}
            onIncludeAllForNote={includeAllMatchesForNote}
            onReplaceSingle={replaceSingle}
          />
        ))}
      </div>

      {/* Confirm Replace All modal */}
      <Modal
        title="Confirm Replace All"
        open={confirmVisible}
        onOk={handleConfirmReplaceAll}
        onCancel={() => setConfirmVisible(false)}
        okText={`Replace ${includedCount} matches`}
        okType="danger"
        icon={<ExclamationCircleOutlined />}
      >
        <Text>
          This will replace <Text strong>{includedCount}</Text> match
          {includedCount !== 1 ? 'es' : ''} across <Text strong>{notesAffected}</Text> note
          {notesAffected !== 1 ? 's' : ''}. A version snapshot will be created for each modified
          note (undo support).
        </Text>
        <br />
        <br />
        <Text type="secondary">
          This action cannot be easily undone in bulk. Make sure you have reviewed the matches.
        </Text>
      </Modal>
    </div>
  );
}
