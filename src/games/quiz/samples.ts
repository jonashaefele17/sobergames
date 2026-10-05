import type { ParsedQuestion } from './parse'

/** Beispielfragen zum Testen. Sie stehen öffentlich im Code und werden vor dem Abend ersetzt. */
export const SAMPLE_QUESTIONS: ParsedQuestion[] = [
  { question: 'Wie viele Bundesländer hat Deutschland?', answer: '16', info: '' },
  { question: 'Welcher Planet ist der Sonne am nächsten?', answer: 'Merkur', info: '' },
  { question: 'Wie heißt die Hauptstadt von Australien?', answer: 'Canberra', info: 'Nicht Sydney!' },
  { question: 'In welchem Jahr fiel die Berliner Mauer?', answer: '1989', info: 'Am 9. November' },
  { question: 'Wie viele Knochen hat ein erwachsener Mensch ungefähr?', answer: '206', info: '' },
  { question: 'Welches chemische Element hat das Symbol „Fe“?', answer: 'Eisen', info: 'Von lateinisch ferrum' },
  { question: 'Wer malte die Mona Lisa?', answer: 'Leonardo da Vinci', info: '' },
  { question: 'Welcher Fluss hat die längste Strecke in Deutschland?', answer: 'Rhein', info: 'Rund 865 km auf deutschem Gebiet' },
  { question: 'Wie viele Spieler einer Fußballmannschaft stehen gleichzeitig auf dem Platz?', answer: '11', info: '' },
  { question: 'Welches ist das größte Organ des Menschen?', answer: 'Die Haut', info: '' },
  { question: 'Aus welchem Land kommt die Band ABBA?', answer: 'Schweden', info: '' },
  { question: 'Wie viele Minuten hat ein Tag?', answer: '1440', info: '' },
  { question: 'Welcher ist der größte Ozean der Erde?', answer: 'Pazifik', info: '' },
  { question: 'Wer schrieb „Faust“?', answer: 'Johann Wolfgang von Goethe', info: '' },
  { question: 'Wie heißt die Hauptstadt von Kanada?', answer: 'Ottawa', info: '' },
  { question: 'In welchem Gebirge liegt der Mount Everest?', answer: 'Himalaya', info: '' },
  { question: 'Welches ist das größte lebende Säugetier?', answer: 'Blauwal', info: '' },
  { question: 'In welcher Stadt steht der Schiefe Turm?', answer: 'Pisa', info: '' },
  { question: 'Wie viele Saiten hat eine normale Gitarre?', answer: '6', info: '' },
  { question: 'Welche Farbe entsteht, wenn man Blau und Gelb mischt?', answer: 'Grün', info: '' },
  { question: 'Wer gilt als Erfinder des Buchdrucks mit beweglichen Lettern in Europa?', answer: 'Johannes Gutenberg', info: '' },
  { question: 'Welches Gas nehmen Pflanzen für die Photosynthese auf?', answer: 'Kohlendioxid (CO₂)', info: '' },
  { question: 'Wie viele Herzen hat ein Oktopus?', answer: '3', info: '' },
  { question: 'In welchem Land liegt Machu Picchu?', answer: 'Peru', info: '' },
  { question: 'Was misst ein Barometer?', answer: 'Den Luftdruck', info: '' },
  { question: 'Wie heißt die Währung von Japan?', answer: 'Yen', info: '' },
  { question: 'Welcher berühmte Komponist wurde in Bonn geboren?', answer: 'Ludwig van Beethoven', info: '' },
  { question: 'Wie viele Ecken hat ein Würfel?', answer: '8', info: '' },
  { question: 'Wie heißt der größte Mond des Saturn?', answer: 'Titan', info: '' },
  { question: 'Wer betrat als erster Mensch den Mond?', answer: 'Neil Armstrong', info: '1969' },
  { question: 'Wie viele Zähne hat ein erwachsener Mensch normalerweise?', answer: '32', info: 'Mit Weisheitszähnen' },
  { question: 'Welche Stadt trägt den Spitznamen „Big Apple“?', answer: 'New York', info: '' },
  { question: 'Wie heißt der kleinste Staat der Welt?', answer: 'Vatikanstadt', info: '' },
  { question: 'Bei wie viel Grad Celsius siedet Wasser auf Meereshöhe?', answer: '100 °C', info: '' },
  { question: 'Wie viele Kontinente gibt es?', answer: '7', info: 'Nach gängiger Zählung' },
]

/** Beispiel-Aussagen für „Wer würde eher“ zum Testen. */
export const SAMPLE_PROMPTS: ParsedQuestion[] = [
  'Wer würde eher einen Marathon ohne Training laufen?',
  'Wer würde eher im Lotto gewinnen und den Schein verlieren?',
  'Wer würde eher eine Woche ohne Handy überleben?',
  'Wer würde eher bei einer Quizshow die Millionenfrage knacken?',
  'Wer würde eher den eigenen Geburtstag vergessen?',
  'Wer würde eher spontan auswandern?',
  'Wer würde eher im Supermarkt nach einem Mitarbeiter gefragt werden?',
  'Wer würde eher einen Zombie-Ausbruch überleben?',
  'Wer würde eher beim Karaoke die Bühne nicht mehr hergeben?',
  'Wer würde eher verschlafen, wenn es wirklich darauf ankommt?',
].map((question) => ({ question, answer: '', info: '' }))

/** Beispiel-Schätzfragen zum Testen; die Antwort ist eine Zahl. */
export const SAMPLE_ESTIMATES: ParsedQuestion[] = [
  { question: 'Wie hoch ist der Eiffelturm mit Antenne?', answer: '330', info: 'Meter' },
  { question: 'Wie viele Einwohner hat Deutschland ungefähr?', answer: '84.000.000', info: 'Einwohner' },
  { question: 'Wie lang ist der Rhein?', answer: '1.233', info: 'Kilometer' },
  { question: 'In welchem Jahr wurde das erste iPhone vorgestellt?', answer: '2007', info: '' },
  { question: 'Wie viele Tasten hat ein Klavier?', answer: '88', info: 'Tasten' },
  { question: 'Wie hoch ist die Zugspitze?', answer: '2.962', info: 'Meter' },
  { question: 'Wie viele Länder gehören zur EU?', answer: '27', info: 'Mitgliedstaaten' },
  { question: 'Wie schwer ist ein Fußball bei Spielbeginn höchstens?', answer: '450', info: 'Gramm' },
  { question: 'Wie viele Stufen führen auf den Kölner Dom (Südturm)?', answer: '533', info: 'Stufen' },
  { question: 'Wie weit ist der Mond im Mittel von der Erde entfernt?', answer: '384.400', info: 'Kilometer' },
]
