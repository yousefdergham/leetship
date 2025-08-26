// Firefox-compatible background script (no ES6 imports)
(function () {
  'use strict';

  // Basic storage functions for Firefox
  const storage = {
    async get(key) {
      try {
        const result = await browser.storage.local.get(key);
        return result[key];
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },

    async set(key, value) {
      try {
        await browser.storage.local.set({ [key]: value });
        return true;
      } catch (error) {
        console.error('Storage set error:', error);
        return false;
      }
    },

    async remove(key) {
      try {
        await browser.storage.local.remove(key);
        return true;
      } catch (error) {
        console.error('Storage remove error:', error);
        return false;
      }
    }
  };

  // GitHub API helper functions
  const githubAPI = {
    async ghFetch(url, token, init = {}) {
      const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'LeetShip (+webextension)',
        ...init.headers,
      };

      const response = await fetch(`https://api.github.com${url}`, {
        ...init,
        headers,
      });

      return response;
    },

    async assertTokenAccepted(token) {
      const response = await this.ghFetch('/rate_limit', token);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token validation failed (${response.status}): ${errorText}`);
      }
    },

    async tryGetUserInfo(token) {
      try {
        const response = await this.ghFetch('/user', token);

        if (response.status === 403) {

          return undefined;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get user info (${response.status}): ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Error getting user info:', error);
        return undefined;
      }
    },

    async validateRepoAccess(token, owner, repo, branch) {
      try {
        const response = await this.ghFetch(`/repos/${owner}/${repo}/branches/${branch}`, token);

        if (!response.ok) {
          const errorText = await response.text();
          return {
            accessible: false,
            permissions: null,
            error: `Cannot access ${owner}/${repo}@${branch}: ${errorText}`
          };
        }

        // Also check repository permissions
        const repoResponse = await this.ghFetch(`/repos/${owner}/${repo}`, token);

        if (!repoResponse.ok) {
          const errorText = await repoResponse.text();
          return {
            accessible: false,
            permissions: null,
            error: `Cannot access repository ${owner}/${repo}: ${errorText}`
          };
        }

        const repoData = await repoResponse.json();

        return {
          accessible: true,
          permissions: repoData.permissions
        };
      } catch (error) {
        return {
          accessible: false,
          permissions: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    async getFileSha(token, owner, repo, path, branch) {
      try {
        const response = await this.ghFetch(
          `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
          token
        );

        if (response.status === 404) {
          return undefined;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get file info (${response.status}): ${errorText}`);
        }

        const fileData = await response.json();
        return fileData.sha;
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return undefined;
        }
        throw error;
      }
    },

    async upsertFile(token, owner, repo, payload) {
      const { path, content, message, branch, sha } = payload;

      // Base64 encode the content
      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      const body = {
        message,
        content: encodedContent,
        branch: branch || 'main',
      };

      // Include SHA if updating existing file
      if (sha) {
        body.sha = sha;
      }

      const response = await this.ghFetch(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upsert file (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      return {
        contentPath: result.content.path,
        commitUrl: result.commit.html_url
      };
    }
  };

  // Simple message handling for Firefox
  browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    // Handle basic messages
    switch (message.type) {
      case 'GET_STATUS':
        // Check if GitHub is configured
        storage.get('LeetShip:config').then(config => {
          const isConfigured = config && config.github && config.github.accessToken;
          sendResponse({ configured: isConfigured, processing: false });
        }).catch(() => {
          sendResponse({ configured: false, processing: false });
        });
        return true; // Keep message channel open for async response

      case 'TEST_CONNECTION':
        storage.get('LeetShip:config').then(config => {
          if (config && config.github && config.github.accessToken) {
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'GitHub not configured' });
          }
        }).catch(() => {
          sendResponse({ success: false, error: 'GitHub not configured' });
        });
        return true; // Keep message channel open for async response

      case 'AUTH_WITH_PAT':
        handleAuthWithPAT(message.payload).then(sendResponse);
        return true; // Keep message channel open for async response

      case 'UPSERT_FILE':
        handleUpsertFile(message.payload).then(sendResponse);
        return true; // Keep message channel open for async response

      case 'SUBMISSION_ACCEPTED':
        handleSubmissionAccepted(message.submission).then(sendResponse);
        return true; // Keep message channel open for async response

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  });

  async function handleAuthWithPAT(payload) {
    try {


      const { token, owner, repository, branch } = payload;

      // Validate the token
      await githubAPI.assertTokenAccepted(token);


      // Try to get user info
      const userInfo = await githubAPI.tryGetUserInfo(token);

      const config = {
        username: userInfo?.login || owner || '',
        repository: repository,
        branch: branch || 'main',
        accessToken: token,
        refreshToken: '', // PATs don't have refresh tokens
        tokenExpiry: undefined, // PATs don't expire unless revoked
      };

      // Store the configuration
      const currentConfig = await storage.get('LeetShip:config') || {};
      currentConfig.github = config;
      await storage.set('LeetShip:config', currentConfig);


      return { success: true, config };
    } catch (error) {
      console.error('❌ PAT authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function handleUpsertFile(payload) {
    try {


      // Get current configuration
      const config = await storage.get('LeetShip:config');

      if (!config?.github?.accessToken || !config.github.username || !config.github.repository) {
        throw new Error('GitHub configuration incomplete. Please configure repository settings.');
      }

      const { path, content, message, branch } = payload;
      const token = config.github.accessToken;
      const owner = config.github.username;
      const repo = config.github.repository;
      const targetBranch = branch || config.github.branch;

      // Validate repository access
      const access = await githubAPI.validateRepoAccess(token, owner, repo, targetBranch);

      if (!access.accessible) {
        throw new Error(access.error || 'Cannot access repository');
      }

      // Get existing file SHA if it exists
      const existingSha = await githubAPI.getFileSha(token, owner, repo, path, targetBranch);

      // Upsert the file
      const result = await githubAPI.upsertFile(token, owner, repo, {
        ...payload,
        branch: targetBranch,
        sha: existingSha
      });


      return { success: true, commitUrl: result.commitUrl };
    } catch (error) {
      console.error('❌ File upsert failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function handleSubmissionAccepted(submissionData) {
    try {


      // Get current configuration
      const config = await storage.get('LeetShip:config');

      if (!config?.github?.accessToken) {


        // Show notification that setup is required
        try {
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: '🔐 LeetShip: Setup Required',
            message: 'Connect your GitHub account to commit solutions'
          });
        } catch (error) {
          console.error('Failed to show notification:', error);
        }

        return { success: false, error: 'GitHub not configured' };
      }



      // Create the file content
      const { title, titleSlug, difficulty, language, code, runtime, memory, timestamp } = submissionData;

      // Generate file path
      const fileExtension = submissionData.fileExtension || getFileExtension(language);
      const fileName = `solution${fileExtension}`;
      const filePath = `${difficulty}/${title}/${fileName}`;

      // Create file content with header comment
      const fileContent = createFileContent(submissionData);

      // Create commit message
      const commitMessage = `Add ${title} solution

Problem: ${title}
Difficulty: ${difficulty}
Language: ${language}
Runtime: ${runtime}
Memory: ${memory}
Submitted: ${timestamp}

🤖 Generated with LeetShip
`;

      // Use the existing upsert function
      const result = await handleUpsertFile({
        path: filePath,
        content: fileContent,
        message: commitMessage
      });

      if (result.success) {


        // Show success notification
        try {
          browser.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: '✅ LeetShip Success',
            message: `${title} committed to GitHub!`
          });
        } catch (error) {
          console.error('Failed to show notification:', error);
        }

        return { success: true, commitUrl: result.commitUrl };
      } else {
        throw new Error(result.error || 'Failed to commit to GitHub');
      }

    } catch (error) {
      console.error('❌ LeetShip: Failed to process submission:', error);

      // Show error notification
      try {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: '❌ LeetShip Error',
          message: `Failed to commit: ${error.message}`
        });
      } catch (notifError) {
        console.error('Failed to show error notification:', notifError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  function getFileExtension(language) {
    const extensions = {
      'JavaScript': '.js',
      'Python': '.py',
      'Python3': '.py',
      'Java': '.java',
      'C++': '.cpp',
      'C': '.c',
      'C#': '.cs',
      'Go': '.go',
      'Ruby': '.rb',
      'Swift': '.swift',
      'Kotlin': '.kt',
      'TypeScript': '.ts',
      'Rust': '.rs',
      'PHP': '.php',
      'Scala': '.scala'
    };
    return extensions[language] || '.txt';
  }

  function createFileContent(submission) {
    const { title, difficulty, language, code, runtime, memory, link, timestamp } = submission;

    const header = `/*
${title}
Difficulty: ${difficulty}
Language: ${language}
Runtime: ${runtime}
Memory: ${memory}
Submitted: ${timestamp}
Link: ${link}
*/

`;

    return header + code;
  }

  // Handle installation
  browser.runtime.onInstalled.addListener(function (details) {


    if (details.reason === 'install') {
      // Open onboarding page
      browser.tabs.create({
        url: browser.runtime.getURL('onboarding.html')
      });
    }
  });


})();
