// How a study reviewer is filed: the Senior High School (K to 12) curriculum that
// Grade 12 students follow in SY 2026-2027, with strands, two grades, and four quarters.
// Keep these lists the same as frontend/src/services/categories.js.

// "All strands" is for core and applied subjects that every strand takes.
const STRANDS = ['All strands', 'STEM', 'ABM', 'HUMSS', 'GAS', 'TVL', 'Arts and Design', 'Sports'];

const GRADES = ['11', '12'];

// Quarters 1 and 2 make up the first semester, 3 and 4 the second.
const QUARTERS = ['1st', '2nd', '3rd', '4th'];

const MATERIAL_TYPES = ['Reviewer', 'Summary notes', 'Practice test', 'Formula sheet', 'Other'];

// Taken by every strand.
const CORE_SUBJECTS = [
  'Oral Communication',
  'Reading and Writing',
  'Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino',
  "Pagbasa at Pagsusuri ng Iba't Ibang Teksto Tungo sa Pananaliksik",
  '21st Century Literature from the Philippines and the World',
  'Contemporary Philippine Arts from the Regions',
  'Media and Information Literacy',
  'General Mathematics',
  'Statistics and Probability',
  'Earth and Life Science',
  'Earth Science',
  'Disaster Readiness and Risk Reduction',
  'Physical Science',
  'Personal Development',
  'Understanding Culture, Society and Politics',
  'Introduction to the Philosophy of the Human Person',
  'Physical Education and Health',
];

// Also taken by every strand, with content shaped for each one.
const APPLIED_SUBJECTS = [
  'English for Academic and Professional Purposes',
  'Practical Research 1',
  'Practical Research 2',
  'Filipino sa Piling Larangan',
  'Empowerment Technologies',
  'Entrepreneurship',
  'Inquiries, Investigations and Immersion',
];

// The subjects only one strand takes.
const SPECIALIZED_SUBJECTS = {
  STEM: [
    'Pre-Calculus',
    'Basic Calculus',
    'General Biology 1',
    'General Biology 2',
    'General Chemistry 1',
    'General Chemistry 2',
    'General Physics 1',
    'General Physics 2',
  ],
  ABM: [
    'Applied Economics',
    'Business Ethics and Social Responsibility',
    'Fundamentals of Accountancy, Business and Management 1',
    'Fundamentals of Accountancy, Business and Management 2',
    'Business Mathematics',
    'Business Finance',
    'Organization and Management',
    'Principles of Marketing',
  ],
  HUMSS: [
    'Creative Writing',
    'Creative Nonfiction',
    'Introduction to World Religions and Belief Systems',
    'Community Engagement, Solidarity and Citizenship',
    'Philippine Politics and Governance',
    'Trends, Networks and Critical Thinking in the 21st Century Culture',
    'Disciplines and Ideas in the Social Sciences',
    'Disciplines and Ideas in the Applied Social Sciences',
  ],
  GAS: [
    'Humanities 1',
    'Humanities 2',
    'Social Science 1',
    'Applied Economics',
    'Organization and Management',
    'Disaster Readiness and Risk Reduction',
  ],
  // TVL courses are too many to list; the exact course name goes in the tags.
  TVL: [
    'Home Economics specialization',
    'ICT specialization',
    'Industrial Arts specialization',
    'Agri-Fishery Arts specialization',
  ],
  'Arts and Design': ['Arts and Design specialized subject'],
  Sports: ['Sports specialized subject'],
};

// Every strand ends its subject list with these.
const CLOSING_SUBJECTS = ['Work Immersion / Research / Culminating Activity', 'Other'];

// Keeps the first copy of each name, so a subject listed twice shows once.
const unique = (names) => {
  return names.filter((name, index) => names.indexOf(name) === index);
};

// The subjects a reviewer for this strand can be filed under, in the order the form shows them.
const subjectsForStrand = (strand) => {
  const specialized = SPECIALIZED_SUBJECTS[strand] || [];
  return unique(CORE_SUBJECTS.concat(APPLIED_SUBJECTS, specialized, CLOSING_SUBJECTS));
};

// Every subject of every strand, for the feed filter.
const ALL_SUBJECTS = unique(STRANDS.flatMap((strand) => subjectsForStrand(strand)));

module.exports = {
  STRANDS: STRANDS,
  GRADES: GRADES,
  QUARTERS: QUARTERS,
  MATERIAL_TYPES: MATERIAL_TYPES,
  ALL_SUBJECTS: ALL_SUBJECTS,
  subjectsForStrand: subjectsForStrand,
};
