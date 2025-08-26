// injected/inject.js  (must run in PAGE context)
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await originalFetch(input, init);
    tryHandleGraphQL(res.clone()).catch(() => { });
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__LeetShip_url = String(url);
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', () => {
      const url = this.__LeetShip_url || '';
      if (url.includes('graphql') && this.status === 200) {
        try {
          const json = JSON.parse(this.responseText);
          handleGraphQLData(json);
        } catch { }
      }
    });
    return origSend.call(this, body);
  };

  async function tryHandleGraphQL(res) {
    const url = res.url || '';
    if (!url.includes('graphql')) return;
    const text = await res.text();
    try { handleGraphQLData(JSON.parse(text)); } catch { }
  }

  function handleGraphQLData(data) {
    console.log('LeetShip: GraphQL data received:', data);

    // Check for submission details in various formats
    const details = data?.data?.submissionDetails || data?.data?.submitCode || data?.data?.submission;
    if (details && (details.statusDisplay === 'Accepted' || details.status === 'Accepted' || details.status === 10)) {
      console.log('LeetShip: Accepted submission detected:', details);
      window.postMessage({ source: 'LeetShip', kind: 'ACCEPTED', payload: details }, '*');
    }

    // Check recent submission list
    const list = data?.data?.recentSubmissionList || data?.data?.recentAcSubmissionList;
    if (Array.isArray(list)) {
      const acceptedSubs = list.filter(s =>
        s.statusDisplay === 'Accepted' || s.status === 'Accepted' || s.status === 10
      );
      acceptedSubs.forEach(s => {
        console.log('LeetShip: Recent accepted submission:', s);
        window.postMessage({ source: 'LeetShip', kind: 'ACCEPTED_RECENT', payload: s }, '*');
      });
    }

    // Check for run code results (some submissions come through runCode endpoint)
    const runResult = data?.data?.runCode;
    if (runResult && (runResult.status_msg === 'Accepted' || runResult.run_success)) {
      console.log('LeetShip: Run code success:', runResult);
      // This might be a successful run, but we should wait for actual submission
    }
  }

  // Optional: expose editor code getter for content script fallback
  Object.defineProperty(window, '__LeetShip_getCode', {
    value: function () {
      try {
        const models = window?.monaco?.editor?.getModels?.();
        if (models && models.length) return models[0].getValue();
        // CodeMirror legacy fallbacks (best-effort)
        const cmEl = document.querySelector('.CodeMirror');
        const cm = cmEl && cmEl.CodeMirror;
        if (cm && typeof cm.getValue === 'function') return cm.getValue();
      } catch { }
      return null;
    },
    writable: false
  });
})();
