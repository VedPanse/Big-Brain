import pdf from 'pdf-parse'
import mammoth from 'mammoth'

export async function extractTextFromPdf(buffer) {
  const data = await pdf(buffer)
  return data.text || ''
}

export async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}
