  const sendMessage = async (event: FormEvent) => {
      event.preventDefault();
      if (!input.trim()) return;
      
      const nextMessages = [...messages, { role: 'user', content: input }];
      setMessages(nextMessages);
      setInput('');
      setLoading(true);
      
      const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.body) {
          setMessages([...nextMessages, { role: 'assistant', content: 'No stream received.' }]);
          setLoading(false);
          return;
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let done = false;
      
      while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          const chunk = decoder.decode(value, { stream: !done });
          for (const line of chunk.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const payload = JSON.parse(line.slice(5));
              if (payload.delta) {
                  assistantText += payload.delta;
                  setMessages([...nextMessages, { role: 'assistant', content: assistantText }]);
              }
          }
      }                                                                                                                                                                                                                                                                                                                                                                                           setLoading(false);                                                                                                                                                                          };                                                                                                                                                                                          