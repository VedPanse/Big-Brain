export const graphSeedData = {
  courses: [
    { id: 'calculus', title: 'Calculus', slug: 'calculus' },
    { id: 'data-structures', title: 'Data Structures', slug: 'data-structures' },
    { id: 'machine-learning', title: 'Machine Learning', slug: 'machine-learning' },
  ],
  concepts: [
    { id: 'limits', label: 'Limits' },
    { id: 'derivatives', label: 'Derivatives' },
    { id: 'chain-rule', label: 'Chain Rule' },
    { id: 'integrals', label: 'Integrals' },
    { id: 'arrays', label: 'Arrays' },
    { id: 'trees', label: 'Trees' },
    { id: 'graphs', label: 'Graphs' },
    { id: 'regression', label: 'Linear Regression' },
    { id: 'backprop', label: 'Backprop' },
    { id: 'attention', label: 'Attention' },
  ],
  courseConcepts: [
    { courseId: 'calculus', conceptId: 'limits', importance: 0.9 },
    { courseId: 'calculus', conceptId: 'derivatives', importance: 0.85 },
    { courseId: 'calculus', conceptId: 'chain-rule', importance: 0.7 },
    { courseId: 'calculus', conceptId: 'integrals', importance: 0.8 },
    { courseId: 'data-structures', conceptId: 'arrays', importance: 0.85 },
    { courseId: 'data-structures', conceptId: 'trees', importance: 0.8 },
    { courseId: 'data-structures', conceptId: 'graphs', importance: 0.75 },
    { courseId: 'machine-learning', conceptId: 'regression', importance: 0.8 },
    { courseId: 'machine-learning', conceptId: 'backprop', importance: 0.78 },
    { courseId: 'machine-learning', conceptId: 'attention', importance: 0.7 },
    { courseId: 'machine-learning', conceptId: 'graphs', importance: 0.55 },
  ],
}

export function seedGraphTables(db) {
  const courseCount = db.prepare('SELECT COUNT(*) as count FROM courses').get()?.count || 0
  if (courseCount > 0) return

  const insertCourse = db.prepare('INSERT INTO courses (id, title, slug) VALUES (?, ?, ?)')
  const insertConcept = db.prepare('INSERT INTO concepts (id, label) VALUES (?, ?)')
  const insertMapping = db.prepare(
    'INSERT INTO course_concepts (course_id, concept_id, importance) VALUES (?, ?, ?)',
  )

  const insertCourses = db.transaction((items) => {
    items.forEach((course) => insertCourse.run(course.id, course.title, course.slug))
  })
  const insertConcepts = db.transaction((items) => {
    items.forEach((concept) => insertConcept.run(concept.id, concept.label))
  })
  const insertMappings = db.transaction((items) => {
    items.forEach((mapping) =>
      insertMapping.run(mapping.courseId, mapping.conceptId, mapping.importance ?? 0.6),
    )
  })

  insertCourses(graphSeedData.courses)
  insertConcepts(graphSeedData.concepts)
  insertMappings(graphSeedData.courseConcepts)
}
