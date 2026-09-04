# Problem Statement: RAG-Based Intelligent Machine Troubleshooting System

## Background

On any factory floor, machines fail in cryptic ways — a blinking code, a three-digit error number, an alarm buzzer with no explanation.

The answer usually does exist, buried on page 214 of a 400-page PDF manual, in a different manual for a similar-but-not-identical model, or scattered across three separate documents that all need to be cross-referenced.

A technician standing next to a stalled production line doesn't have time to search — every minute of downtime costs money.

---

## The Challenge

Design and build a **RAG-based troubleshooting assistant** that lets a technician type or ask almost anything:

* An error code
* A symptom
* A machine name
* A vague description such as *"it's making a weird noise"*

The system should return a **precise, trustworthy, and sourced answer** pulled from the correct manual rather than a hallucinated guess.

This is harder than a standard *"chat with your PDF"* demo.

Real manuals are messy:

* The same error code can mean different things on different machines.
* Critical steps may be hidden in tables and diagrams rather than clean paragraphs.
* Relevant information may be scattered across multiple documents that need to be cross-referenced.
* A wrong or invented answer during troubleshooting isn't just unhelpful — it can be genuinely unsafe.

Your system needs to know **not only what to retrieve, but which document the information belongs to** and, just as importantly, **when to admit that it doesn't know**.

---

# What You Need to Build

Your prototype should demonstrate the full pipeline:

**Manuals → Document Processing → Chunking → Embeddings → Retrieval → Context Assembly → LLM Response → Cited Solution**

At minimum, it must:

### 1. Ingest Multiple Manuals

Ingest multiple PDF manuals covering different machines.

The dataset must include **at least one pair of manuals with overlapping or similar error codes that have different meanings**.

### 2. Build a Searchable Knowledge Base

Build a searchable knowledge base using:

* Proper document processing
* Chunking
* Embeddings
* Vector or hybrid search

Do **not** treat each manual as a single giant block of text.

### 3. Handle Multiple Query Styles

The system should support at least three types of queries:

#### Exact Error Codes

Example:

> `E101`

#### Natural-Language Symptoms

Example:

> Why is Machine A overheating?

#### Machine/Model-Scoped Questions

Example:

> What does E101 mean on Machine B Model X200?

### 4. Disambiguate Correctly

If the same error code exists across multiple manuals, the system must retrieve information from the **correct machine/manual**.

It should use available context clues such as:

* Machine name
* Model number
* Previously mentioned symptoms
* Conversation history
* Document metadata

If the machine cannot be determined reliably, the system should **ask a clarifying question** rather than guessing.

### 5. Return Structured Answers

Answers should contain:

1. **Error meaning**
2. **Probable causes**
3. **Step-by-step corrective action**
4. **Source citation**

Each citation should include, where available:

* Manual name
* Section
* Page number

Example:

> **Source:** Machine A Service Manual, Section 5.2, Page 214

### 6. Support Follow-Up Conversation

The system should maintain context across a conversation.

For example:

**Technician:**

> Machine A is showing E101. What does it mean?

**Assistant:**

> E101 indicates an overheating condition...

**Technician:**

> And what if that doesn't fix it?

The technician should **not need to repeat the machine or error code**.

### 7. Refuse Gracefully

If the manuals do not contain enough information to answer the question, the system must explicitly say so.

It should **not invent a plausible-sounding repair procedure**.

Example:

> I couldn't find a documented corrective procedure for this condition in the available manuals. I don't have enough source information to recommend a repair safely.

### 8. Ship a Usable Interface

Provide a simple usable interface, such as:

* Web application
* Chat interface

The prototype should be usable by a technician and **not merely expose an API tested through `curl`**.

---

# Where the Real Difficulty Lies

Anyone can wire an embedding model to a PDF loader.

What separates a working demo from a genuinely reliable troubleshooting tool is the following.

## 1. Cross-Document Ambiguity Resolution

The same error code can have different meanings on different machines.

For example:

```text
Machine A → E101 → Overheating
Machine B → E101 → Sensor Failure
```

Retrieving the wrong document could cause the technician to follow the wrong repair procedure.

**Getting this wrong is potentially dangerous.**

---

## 2. Retrieval Precision Over Recall

The system should prioritize retrieving **correct and relevant chunks** rather than simply returning many potentially relevant chunks.

Pulling in plausible-looking but incorrect information can be worse than returning no result.

The system should therefore favor:

> **Precision over recall**

when the retrieved information is used to generate troubleshooting instructions.

---

## 3. Hallucination Control Under Pressure

LLMs are naturally inclined to be helpful, even when the source material does not contain enough information.

A prompt saying:

> "Don't hallucinate."

is not sufficient on its own.

The system needs a **real mechanism for detecting insufficient or unreliable context**.

Possible mechanisms include:

* Retrieval score thresholds
* Reranking
* Evidence coverage checks
* Context sufficiency classification
* Citation validation
* Answer grounding checks
* Refusal thresholds

---

## 4. Traceability

Every important claim in the generated answer should be defensible against the source documentation.

The output should allow the technician to trace information back to:

**Answer → Chunk → Section → Page → Manual**

In a troubleshooting system, *"trust me"* isn't good enough.

---

## 5. Non-Text Content

Industrial manuals frequently contain important information in:

* Tables
* Diagrams
* Flowcharts
* Schematics
* Warning boxes
* Structured layouts

Naive PDF text extraction can destroy this structure.

The document-processing pipeline should therefore consider how to preserve or recover important information from these formats.

---

# Bonus Features

The following features are optional but can significantly improve the prototype.

* **OCR** for scanned manuals
* **Hybrid search** using keyword + vector search
* **Reranking** of retrieved chunks
* **Multilingual queries**
* **Voice queries**
* **Image/diagram retrieval**
* **Confidence scoring**
* **Automatic machine/model detection from query context**
* **Machine/model-aware retrieval**
* **Conversation-aware retrieval**
* **Citation verification**
* **Evidence sufficiency detection**

---

# Deliverables

## 1. Working Prototype

Provide a working prototype with:

* Setup instructions
* Installation instructions
* Configuration requirements
* Instructions for loading manuals
* Instructions for running the application

---

## 2. Architecture Note

Provide a short architecture document explaining:

* Document ingestion
* PDF processing
* Chunking strategy
* Metadata extraction
* Embedding model
* Vector database/search engine
* Retrieval strategy
* Reranking strategy, if applicable
* Context assembly
* LLM selection
* Hallucination-control strategy
* Citation generation
* Refusal/insufficient-information mechanism

---

## 3. Live Demo

The live demo should include at least:

### Exact-Code Query

Example:

> `E101`

### Natural-Language Query

Example:

> Why is Machine A overheating?

### Cross-Manual Ambiguity Case

Demonstrate a situation where the **same error code has different meanings across two manuals**.

The system should either:

* Correctly identify the relevant machine from context, or
* Ask the technician for clarification.

### Insufficient-Information Case

Ask a question for which the available manuals do not provide sufficient information.

The system should **refuse gracefully rather than hallucinate an answer**.

---

## 4. Sample Outputs

Provide sample outputs demonstrating:

* Error interpretation
* Probable causes
* Corrective actions
* Manual citations
* Section references
* Page numbers
* Clarifying questions
* Follow-up conversation
* Graceful refusal

---

# Expected End-to-End Architecture

A successful prototype should roughly implement the following flow:

```text
                    ┌──────────────────┐
                    │  Machine Manuals │
                    │      (PDFs)      │
                    └────────┬─────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Document Processing │
                  │  PDF / OCR / Tables │
                  └──────────┬──────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │    Chunking    │
                    │ + Metadata     │
                    └───────┬────────┘
                            │
                            ▼
                    ┌────────────────┐
                    │   Embeddings   │
                    └───────┬────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │ Search / Retrieval  │
                  │ Vector + Keyword    │
                  └──────────┬──────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │   Reranking  │
                     └──────┬───────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │ Context Assembly    │
                  │ + Conversation      │
                  │ + Machine Context   │
                  └──────────┬──────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │      LLM       │
                    │ Answer + Cite  │
                    └───────┬────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │ Grounding / Safety  │
                  │ Sufficiency Check   │
                  └──────────┬──────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
             ┌─────────────┐   ┌─────────────┐
             │ Cited Answer│   │   Refusal / │
             │             │   │ Clarification│
             └─────────────┘   └─────────────┘
```

# Core Success Criteria

The prototype should ultimately demonstrate five key properties:

| Capability         | Expected Behavior                                               |
| ------------------ | --------------------------------------------------------------- |
| **Retrieval**      | Finds the correct manual and relevant chunks                    |
| **Disambiguation** | Distinguishes identical error codes across machines             |
| **Grounding**      | Answers only from available documentation                       |
| **Traceability**   | Provides manual, section, and page citations                    |
| **Safety**         | Refuses or asks for clarification when evidence is insufficient |

> **The goal is not simply to build a chatbot that can search PDFs. The goal is to build a trustworthy troubleshooting assistant that knows what the manuals say, knows which machine they apply to, and knows when the available evidence is not sufficient to provide an answer.**
