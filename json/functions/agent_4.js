return {
    messages: [
        new AIMessage(
            {
                content: '',
                tool_calls: [
                    {
                        id: 'call_rtk',
                        name: 'bash_command',
                        args: {
                            command: 'echo rtk-json-ok'
                        }
                    }
                ]
            }
        )
    ]
};