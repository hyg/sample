import { createMachine, assign, createActor } from 'xstate';

const Machine1406 = createMachine({
    context: {
        order: [""],
        log: [""],
        review: [""]
    },
    initial: "idle",
    state: {}
},
    {
        actions: {
            addtodoitem: (context, event) => {
                // make role and item from context,event
                let role = "test role";
                let item = {id:"asdfghjkl",name:"test item",readme:"test readme"};
                console.log('add todo item:',role,item);
              },

        }
    }
)