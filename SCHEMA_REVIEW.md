# Legacy Schema Review & Model Linking Analysis

> Archived context from the pre-alpha YAML/sql.js spike. This file reviews the
> legacy `systems`/`models`/`provenance` schema and model-to-model linking demo;
> it does **not** describe the active LearningPack v0 contract.
>
> Current schema source of truth: `spec/learning-pack.schema.json`.
> Current graph/validator decisions: `ai/decisions.md` (especially D-005 and
> D-013).

## Legacy Schema Status: ✅ Sufficient For The Old Demo

### Strengths

1. **Model-to-Model Linking SUPPORTED** ✅
   - Models CAN link to other models using relationship types:
     - `extends`: Model B builds on Model A
     - `contradicts`: Competing models
     - `supports`: Complementary models
     - `requires`: Prerequisite understanding
     - `explains`: One model clarifies another

   Example:
   ```yaml
   - from: model-quantum-computing
     to: model-superposition
     type: requires
     strength: 100
   ```

2. **Flexible Relationship System**
   - 7 semantic relationship types cover most use cases
   - Bidirectional navigation in UI
   - Strength scoring (0-100)
   - Tags for additional context

3. **Clear Separation of Concerns**
   - Systems = What to do (actionable)
   - Models = What to know (conceptual)
   - Provenance = Why (justification)

4. **Permalink Support**
   - Stable IDs for permanent linking
   - Hash-based routing for static hosting
   - Shareable URLs for all 109 entities

### Potential Enhancements (Optional)

1. **Additional Relationship Types** (if needed):
   - `composed-of`: For hierarchical decomposition
   - `alternative-to`: For competing approaches
   - `analogous-to`: For metaphorical relationships
   - `instantiates`: For theory → application

2. **Hierarchical Tags**:
   - Currently flat: `[AI, machine-learning, deep-learning]`
   - Could support: `AI > machine-learning > deep-learning`

3. **Version Control** (for provenance):
   - Track when research updates or gets superseded
   - Link to newer versions of same concept

## Recommendations

**For legacy spike needs**: ✅ Schema is sufficient

The legacy schema supports:
- Model-to-model relationships (all types)
- Complex knowledge graphs
- Physics, AI/ML, philosophy content
- Cross-domain linking

**Action**: Do not use this file as guidance for active alpha work. For new
source-to-pack work, use LearningPack v0 and the validator.

## Example: Complex Model Linking

```yaml
models:
  - id: model-quantum-superposition
    title: "Quantum Superposition"
    type: principle
    evidence_links: [research-schrodinger-equation]

  - id: model-quantum-entanglement
    title: "Quantum Entanglement"
    type: principle
    evidence_links: [research-epr-paradox]

  - id: model-quantum-computing
    title: "Quantum Computing"
    type: framework
    evidence_links: [research-shor-algorithm]

relationships:
  - from: model-quantum-computing
    to: model-quantum-superposition
    type: requires
    strength: 100
    tags: [prerequisite, foundational]

  - from: model-quantum-computing
    to: model-quantum-entanglement
    type: uses
    strength: 95
    tags: [core-mechanism]

  - from: model-quantum-entanglement
    to: model-quantum-superposition
    type: extends
    strength: 85
    tags: [builds-upon]
```

This creates a knowledge graph where models reference each other explicitly.
