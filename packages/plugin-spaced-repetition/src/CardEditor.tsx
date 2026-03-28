/**
 * CardEditor — Create and edit flashcards.
 *
 * Supports:
 * - Basic front/back cards
 * - Cloze card creation with live preview
 * - Tag assignment
 * - Deck selection
 * - Inline syntax insertion helpers
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useCardStore, createFlashcard, generateId } from './card-store';
import type { Flashcard, Deck } from './card-store';
import { extractClozeMarkers, hideClozeGroup, serializeInlineCard } from './card-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardEditorProps {
  /** Card to edit. null means "create a new card". */
  card?: Flashcard | null;
  /** Pre-selected deck ID. Required when creating a new card. */
  defaultDeckId?: string;
  /** Available decks for the deck selector. */
  decks: Deck[];
  /** Called when the card is saved successfully. */
  onSave?: (card: Flashcard) => void;
  /** Called when the user cancels editing. */
  onCancel?: () => void;
}

type CardMode = 'basic' | 'cloze';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardEditor({ card, defaultDeckId, decks, onSave, onCancel }: CardEditorProps) {
  const addCard = useCardStore((s) => s.addCard);
  const updateCard = useCardStore((s) => s.updateCard);

  const isEditing = card !== null && card !== undefined;

  // Form state
  const [mode, setMode] = useState<CardMode>(() => {
    if (card?.front && extractClozeMarkers(card.front).length > 0) return 'cloze';
    return 'basic';
  });
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(card?.tags ?? []);
  const [deckId, setDeckId] = useState(card?.deckId ?? defaultDeckId ?? decks[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  // Cloze preview
  const clozeMarkers = useMemo(() => extractClozeMarkers(front), [front]);

  const clozePreview = useMemo(() => {
    if (mode !== 'cloze' || clozeMarkers.length === 0) return null;
    const firstGroup = clozeMarkers[0].groupId;
    return hideClozeGroup(front, firstGroup);
  }, [mode, clozeMarkers, front]);

  // ---------------------------------------------------------------------------
  // Tag management
  // ---------------------------------------------------------------------------

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag();
      }
    },
    [addTag],
  );

  // ---------------------------------------------------------------------------
  // Cloze helpers
  // ---------------------------------------------------------------------------

  const insertClozeMarker = useCallback(() => {
    const nextGroupNum = clozeMarkers.length + 1;
    const marker = `{{c${nextGroupNum}::answer}}`;
    setFront((prev) => `${prev}${prev.endsWith(' ') ? '' : ' '}${marker}`);
    if (mode !== 'cloze') setMode('cloze');
  }, [clozeMarkers.length, mode]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(() => {
    setError(null);

    if (!front.trim()) {
      setError('Front side is required.');
      return;
    }

    if (mode === 'basic' && !back.trim()) {
      setError('Back side is required for basic cards.');
      return;
    }

    if (!deckId) {
      setError('Please select a deck.');
      return;
    }

    if (mode === 'cloze' && clozeMarkers.length === 0) {
      setError('Cloze cards must contain at least one {{cN::answer}} marker.');
      return;
    }

    if (isEditing && card) {
      updateCard(card.id, {
        front: front.trim(),
        back: back.trim(),
        tags,
        deckId,
      });
      const updated: Flashcard = { ...card, front: front.trim(), back: back.trim(), tags, deckId };
      onSave?.(updated);
    } else {
      const newCard = createFlashcard({
        id: generateId(),
        deckId,
        noteId: '',
        front: front.trim(),
        back: back.trim(),
        tags,
      });
      addCard(newCard);
      onSave?.(newCard);
    }
  }, [
    front,
    back,
    mode,
    deckId,
    tags,
    clozeMarkers.length,
    isEditing,
    card,
    updateCard,
    addCard,
    onSave,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="sr-card-editor" data-testid="card-editor">
      <div className="sr-editor-header">
        <h2 className="sr-editor-title">{isEditing ? 'Edit Card' : 'New Card'}</h2>
      </div>

      {/* Mode toggle */}
      <div className="sr-mode-toggle" role="group" aria-label="Card type">
        <button
          className={`sr-mode-btn ${mode === 'basic' ? 'sr-mode-btn--active' : ''}`}
          onClick={() => setMode('basic')}
          aria-pressed={mode === 'basic'}
          type="button"
        >
          Basic
        </button>
        <button
          className={`sr-mode-btn ${mode === 'cloze' ? 'sr-mode-btn--active' : ''}`}
          onClick={() => setMode('cloze')}
          aria-pressed={mode === 'cloze'}
          type="button"
        >
          Cloze
        </button>
      </div>

      {/* Front */}
      <div className="sr-field">
        <label className="sr-label" htmlFor="card-front">
          {mode === 'cloze' ? 'Sentence (with cloze markers)' : 'Front'}
        </label>
        <textarea
          id="card-front"
          className="sr-textarea"
          data-testid="card-front-input"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder={
            mode === 'cloze'
              ? 'The capital of {{c1::France}} is Paris.'
              : 'What is the capital of France?'
          }
          rows={3}
        />
        {mode === 'cloze' && (
          <button
            className="sr-btn sr-btn-ghost sr-btn-sm"
            type="button"
            onClick={insertClozeMarker}
          >
            + Insert cloze marker
          </button>
        )}
      </div>

      {/* Cloze preview */}
      {mode === 'cloze' && clozePreview !== null && (
        <div className="sr-cloze-preview" aria-label="Cloze preview">
          <span className="sr-cloze-preview-label">Preview: </span>
          {clozePreview}
        </div>
      )}

      {/* Back */}
      {mode === 'basic' && (
        <div className="sr-field">
          <label className="sr-label" htmlFor="card-back">
            Back
          </label>
          <textarea
            id="card-back"
            className="sr-textarea"
            data-testid="card-back-input"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Paris"
            rows={3}
          />
        </div>
      )}

      {/* Deck selector */}
      {decks.length > 0 && (
        <div className="sr-field">
          <label className="sr-label" htmlFor="card-deck">
            Deck
          </label>
          <select
            id="card-deck"
            className="sr-select"
            data-testid="deck-select"
            value={deckId}
            onChange={(e) => setDeckId(e.target.value)}
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tags */}
      <div className="sr-field">
        <label className="sr-label" htmlFor="card-tags">
          Tags
        </label>
        <div className="sr-tags-input">
          {tags.map((tag) => (
            <span key={tag} className="sr-tag sr-tag--removable">
              {tag}
              <button
                className="sr-tag-remove"
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="card-tags"
            className="sr-tag-input"
            data-testid="tag-input"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={addTag}
            placeholder="Add tag..."
          />
        </div>
      </div>

      {/* Inline syntax preview */}
      {mode === 'basic' && front && back && (
        <div className="sr-syntax-preview" aria-label="Inline syntax preview">
          <span className="sr-syntax-label">Syntax: </span>
          <code className="sr-syntax-code">{serializeInlineCard(front, back)}</code>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="sr-error" role="alert" data-testid="editor-error">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="sr-editor-actions">
        <button
          className="sr-btn sr-btn-primary"
          type="button"
          onClick={handleSave}
          data-testid="save-card-btn"
        >
          {isEditing ? 'Save Changes' : 'Add Card'}
        </button>
        {onCancel && (
          <button
            className="sr-btn sr-btn-secondary"
            type="button"
            onClick={onCancel}
            data-testid="cancel-btn"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
