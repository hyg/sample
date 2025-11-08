const { httpTransport, emitterFor, CloudEvent } = require("cloudevents");

// Create an emitter to send events to a receiver
//const emit = emitterFor(httpTransport("https://my.receiver.com/endpoint"));
const emit = emitterFor(httpTransport("http://localhost:3000"));

// Create a new CloudEvent
//const ce = new CloudEvent({ type, source, data });
const ce = new CloudEvent({ type:"com.PSMD.hox.callfor", source:"/PSMD/hox", data:{id:"123455678",date:"2025-11-31"} });

// Send it to the endpoint - encoded as HTTP binary by default
emit(ce);