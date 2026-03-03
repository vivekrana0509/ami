/**
 * Core interfaces for the Agent Mind Interface (ami).
 * This file defines the agnostic cognitive skeleton.
 */

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Episodic Memory: The short-term "sliding window" of experiences.
 */
export interface EpisodicMemory {
    getRecentContext(limit?: number): Promise<Message[]>;
    storeEpisode(message: Message): Promise<void>;
    clear(): Promise<void>;
}

/**
 * Semantic Memory: Long-term fact storage.
 */
export interface SemanticMemory {
    query(query: string, limit?: number): Promise<SearchResult[]>;
    storeFact(fact: Fact): Promise<void>;
    forget(factId: string): Promise<void>;
}

export interface SearchResult {
    fact: Fact;
    score: number;
}

export interface Fact {
    id: string;
    text: string;
    relations: string[]; // IDs of related facts
    sourceEpisodeId?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Knowledge Distiller: The process of moving info from episodic to semantic.
 * This is the "Agent Dream" loop.
 */
export interface KnowledgeDistiller {
    distill(episodes: Message[]): Promise<Fact[]>;
}

/**
 * Cognitive Loop: The OODA loop (Observe, Orient, Decide, Act).
 */
export interface CognitiveLoop {
    step(): Promise<void>;
}
