import { google } from "googleapis";
import { getAccessTokenFromTokenVault } from "@auth0/ai-langchain";

export async function getGoogleDriveClient() {
  try {
    // Get the access token for Google APIs from Auth0's Token Vault
    const accessToken = await getAccessTokenFromTokenVault();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    return google.drive({ version: "v3", auth });
  } catch (error: any) {
    throw new Error(`Failed to initialize Google Drive: ${error.message}`);
  }
}

export async function listGoogleDriveFiles(pageSize: number = 10) {
  try {
    const drive = await getGoogleDriveClient();

    const response = await drive.files.list({
      pageSize,
      fields: "files(id, name, mimeType, createdTime, webViewLink)",
      orderBy: "createdTime desc",
    });

    return response.data.files || [];
  } catch (error: any) {
    throw new Error(`Failed to list Google Drive files: ${error.message}`);
  }
}

export async function createGoogleDocument(title: string, content?: string) {
  try {
    const drive = await getGoogleDriveClient();

    // Create a Google Doc
    const response = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: "application/vnd.google-apps.document",
      },
      fields: "id, name, webViewLink",
    });

    const fileId = response.data.id;

    // If content provided, add it to the document using Google Docs API
    if (content && fileId) {
      const docs = google.docs({
        version: "v1",
        auth: (await getGoogleDriveClient()) as any,
      });

      await docs.documents.batchUpdate({
        documentId: fileId,
        requestBody: {
          requests: [
            {
              insertText: {
                text: content,
                location: { index: 1 },
              },
            },
          ],
        },
      });
    }

    return {
      id: fileId,
      name: response.data.name,
      link: response.data.webViewLink,
    };
  } catch (error: any) {
    throw new Error(`Failed to create Google Document: ${error.message}`);
  }
}

export async function shareGoogleFile(fileId: string, email: string) {
  try {
    const drive = await getGoogleDriveClient();

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "user",
        emailAddress: email,
      },
    });

    return { success: true, message: `File shared with ${email}` };
  } catch (error: any) {
    throw new Error(`Failed to share Google file: ${error.message}`);
  }
}
