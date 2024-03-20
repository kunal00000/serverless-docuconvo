import type { Request, Response } from 'express';
import { PineconeStore } from '@langchain/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIStream, streamToResponse } from 'ai';

export const searchQuery = async (req: Request, res: Response) => {
  const { pineconeApiKey, pineconeIndexName, projectId, messages } = req.body;

  const searchQuery = messages[messages.length - 1].content;
  console.log('received query', searchQuery);

  try {
    const pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });

    const pineconeIndex = await pinecone.Index(pineconeIndexName);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'embedding-001',
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
    });

    // similar vectors
    const results = await vectorStore.similaritySearch(searchQuery, 2, {
      project: projectId,
    });
    let contextText: string =
      results[0]?.pageContent.replace(/<[^>]*>?/gm, '') +
      ' ' +
      results[1]?.pageContent.replace(/<[^>]*>?/gm, '');

    const resultTwo = await model.generateContentStream(
      getPrompt(searchQuery, contextText)
    );

    const stream = GoogleGenerativeAIStream(resultTwo);

    streamToResponse(stream, res);
  } catch (err: any) {
    return res.status(404).json({
      success: false,
      message: `Something went wrong: ${err.message}.`,
      answer: null,
    });
  }
};

const getPrompt = (query: string, context: string) => {
  return `
  ${`
  You are a highly dedicated representative of our tech company,
  committed to assisting and delighting our users. 
  Given the provided sections from the Organization
  documentation, please respond to the inquiry using
  only that information. In cases where the answer is not
  explicitly stated in the documentation,
  maintaining a professional and friendly tone.
  `}

  Context sections:
  ${context}

  Question: """
  ${query}
  """

  Answer as markdown (including related code snippets if available):
`;
};
