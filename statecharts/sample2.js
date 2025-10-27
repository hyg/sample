import { createMachine, assign, createActor } from 'xstate';

const textMachine = createMachine({
  context: {
    committedValue: '',
    value: '',
  },
  initial: 'reading',
  states: {
    reading: {
      on: {
        'text.edit': { target: 'editing' },
      },
    },
    editing: {
      on: {
        'text.change': {
          actions: assign({
            value: ({ event }) => event.value,
          }),
        },
        'text.commit': {
          actions: assign({
            committedValue: ({ context }) => context.value,
          }),
          target: 'reading',
        },
        'text.cancel': {
          actions: assign({
            value: ({ context }) => context.committedValue,
          }),
          target: 'reading',
        },
      },
    },
  },
});

const textActor = createActor(textMachine).start();

textActor.subscribe((state) => {
  //console.log(state.context.value);
  console.log(state.context);
});

textActor.send({ type: 'text.edit' });
// logs ''
textActor.send({ type: 'text.change', value: 'Hello' });
// logs 'Hello'
textActor.send({ type: 'text.commit' });
// logs 'Hello'
textActor.send({ type: 'text.edit' });
// logs 'Hello'
textActor.send({ type: 'text.change', value: 'Hello world' });
// logs 'Hello world'
textActor.send({ type: 'text.cancel' });
// logs 'Hello'