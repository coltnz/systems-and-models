# Knowledge Graph Data Schema

## Overview

This schema defines the YAML format for importing systems, models, provenance, and their relationships into the knowledge graph.

## Key Principles

1. **Separation of Concerns**: Actions (systems), knowledge (models), and justifications (provenance) are separate entities
2. **Clear References**: Every claim should reference provenance (quotes, theorems, principles, facts)
3. **Actionability**: Systems must contain clear, executable steps
4. **Traceability**: All relationships must be explicit and typed

## Entity Types

### Systems (What to Do)

Systems are actionable processes, methodologies, or workflows.

```yaml
systems:
  - id: hiring-structured-interviews
    title: "Structured Interview Process"
    description: "Standardized interview methodology with consistent questions"
    status: active
    tags: [hiring, interviews, process]
    content: |
      1. Define role competencies
      2. Create standardized question bank
      3. Train interviewers on scoring rubric
      4. Conduct interviews with same questions
      5. Score independently using rubric
      6. Aggregate scores for decision
    evidence_links:
      - theory-structured-interviews-validity
      - fact-google-hiring-study
```

**Fields:**
- `id`: Unique identifier (kebab-case)
- `title`: Short, descriptive name
- `description`: One-line summary
- `status`: draft | active | archived | proven
- `tags`: Array of categorization tags
- `content`: Detailed steps/instructions (markdown)
- `evidence_links`: Array of provenance IDs that justify this system

### Models (What to Know)

Models are mental frameworks, concepts, or theories for understanding.

```yaml
models:
  - id: mental-model-circle-of-competence
    title: "Circle of Competence"
    description: "Operating within areas where you have deep expertise"
    type: mental-model
    tags: [decision-making, expertise, boundaries]
    content: |
      Know the boundaries of your expertise. Make decisions confidently
      within your circle. Seek expert help outside it. Constantly expand
      your circle through learning, but know where the edges are.
    evidence_links:
      - quote-buffett-circle-of-competence
      - principle-socratic-wisdom
```

**Fields:**
- `id`: Unique identifier (kebab-case)
- `title`: Short, descriptive name
- `description`: One-line summary
- `type`: mental-model | concept | framework | principle
- `tags`: Array of categorization tags
- `content`: Detailed explanation (markdown)
- `evidence_links`: Array of provenance IDs

### Provenance (Why - Justifications)

Provenance provides the evidence, reasoning, and sources for systems and models.

```yaml
provenance:
  - id: quote-buffett-circle-of-competence
    type: quote
    title: "Warren Buffett on Circle of Competence"
    description: "Stay within your area of expertise"
    source: "Warren Buffett, 1999 Berkshire Hathaway Annual Meeting"
    source_url: "https://www.berkshirehathaway.com/letters/1999.html"
    credibility_score: 95
    tags: [buffett, investing, wisdom]
    content: |
      "You don't have to be an expert on every company, or even many.
      You only have to be able to evaluate companies within your circle
      of competence. The size of that circle is not very important;
      knowing its boundaries, however, is vital."

  - id: theory-structured-interviews-validity
    type: theory
    title: "Structured Interview Validity Theory"
    description: "Structured interviews predict job performance better than unstructured"
    source: "Schmidt & Hunter (1998), Personnel Psychology"
    source_url: "https://doi.org/10.1111/j.1744-6570.1998.tb00743.x"
    credibility_score: 98
    tags: [psychology, hiring, validity]
    content: |
      Meta-analysis of 85 years of research shows structured interviews
      have validity coefficient of 0.51 vs 0.38 for unstructured.
      Combining with cognitive ability tests increases to 0.63.

  - id: principle-pareto-80-20
    type: principle
    title: "Pareto Principle (80/20 Rule)"
    description: "80% of effects come from 20% of causes"
    source: "Vilfredo Pareto, 1896"
    credibility_score: 90
    tags: [economics, distribution, efficiency]
    content: |
      Observed in wealth distribution, but applicable to many domains:
      80% of results from 20% of effort, 80% of bugs from 20% of code,
      80% of sales from 20% of customers.

  - id: fact-google-hiring-study
    type: research
    title: "Google's Project Oxygen - Interview Process Study"
    description: "Google found structured interviews increased quality of hire"
    source: "Google re:Work, Project Oxygen"
    source_url: "https://rework.withgoogle.com/guides/hiring-use-structured-interviewing/"
    credibility_score: 92
    tags: [google, hiring, data]
    content: |
      After analyzing hiring data, Google found structured interviews
      with consistent rubrics reduced bias and improved hire quality
      by 25% compared to unstructured approaches.
```

**Fields:**
- `id`: Unique identifier (kebab-case)
- `type`: theory | quote | fact | principle | corollary | research
- `title`: Short, descriptive name
- `description`: One-line summary
- `source`: Author/origin citation
- `source_url`: Link to original source (optional)
- `credibility_score`: 0-100 rating of source reliability
- `tags`: Array of categorization tags
- `content`: Full text/explanation (markdown)

### Relationships

Relationships connect entities with semantic meaning.

```yaml
relationships:
  - from: hiring-structured-interviews
    to: theory-structured-interviews-validity
    type: evidences
    strength: 95
    tags: [validation, research-backed]

  - from: hiring-structured-interviews
    to: mental-model-circle-of-competence
    type: requires
    strength: 70
    tags: [prerequisite]

  - from: mental-model-circle-of-competence
    to: quote-buffett-circle-of-competence
    type: evidences
    strength: 100
    tags: [origin, source]
```

**Fields:**
- `from`: Source entity ID
- `to`: Target entity ID
- `type`: uses | explains | requires | extends | contradicts | supports | evidences
- `strength`: 0-100 (optional) - how strong is this relationship
- `tags`: Array of categorization tags (optional)

**Relationship Types:**
- `uses`: System uses another system/model
- `explains`: Model explains a system/concept
- `requires`: Prerequisite relationship
- `extends`: Builds upon or enhances
- `contradicts`: Conflicts with
- `supports`: Backs up or reinforces
- `evidences`: Provides proof/justification for

## File Format

```yaml
# knowledge-base.yaml
version: "1.0"
metadata:
  created: 2025-01-17
  description: "Core knowledge graph of important systems and models"

systems:
  - id: ...
    title: ...
    # ... system fields

models:
  - id: ...
    title: ...
    # ... model fields

provenance:
  - id: ...
    type: ...
    # ... provenance fields

relationships:
  - from: ...
    to: ...
    type: ...
```

## Best Practices

1. **Use Clear IDs**: Use kebab-case, descriptive IDs (e.g., `system-gtd-workflow`, not `sys1`)
2. **Tag Generously**: Tags enable search and categorization
3. **Link Everything**: Every system/model should reference provenance
4. **Cite Sources**: Always include source and source_url for provenance
5. **Be Specific**: Content should be actionable and clear
6. **Rate Credibility**: Use credibility scores to indicate source quality (peer-reviewed: 95-100, expert: 85-95, anecdotal: 60-75)

## Example: Complete Entry

```yaml
systems:
  - id: system-pomodoro-technique
    title: "Pomodoro Technique"
    description: "Time management using 25-minute focused work intervals"
    status: proven
    tags: [productivity, time-management, focus]
    content: |
      1. Choose a task to work on
      2. Set timer for 25 minutes
      3. Work with full focus until timer rings
      4. Take 5-minute break
      5. After 4 pomodoros, take 15-30 minute break
    evidence_links:
      - fact-pomodoro-effectiveness
      - principle-timeboxing

models:
  - id: mental-model-flow-state
    title: "Flow State"
    description: "State of optimal experience and peak performance"
    type: concept
    tags: [psychology, performance, focus]
    content: |
      Characterized by complete absorption, loss of self-consciousness,
      clear goals, immediate feedback, and balance between challenge
      and skill. Achieved through focused attention and eliminating
      distractions.
    evidence_links:
      - theory-csikszentmihalyi-flow
      - research-flow-productivity

provenance:
  - id: theory-csikszentmihalyi-flow
    type: theory
    title: "Csikszentmihalyi's Flow Theory"
    description: "Theory of optimal experience and peak performance"
    source: "Mihaly Csikszentmihalyi, Flow: The Psychology of Optimal Experience (1990)"
    credibility_score: 97
    tags: [psychology, csikszentmihalyi, flow]
    content: |
      Flow occurs when skill level matches challenge level, with clear
      goals and immediate feedback. Requires focused concentration and
      elimination of distractions.

relationships:
  - from: system-pomodoro-technique
    to: mental-model-flow-state
    type: supports
    strength: 85
    tags: [complementary, focus]

  - from: mental-model-flow-state
    to: theory-csikszentmihalyi-flow
    type: evidences
    strength: 100
    tags: [research, foundational]
```
