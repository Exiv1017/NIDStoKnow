import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MIN_LESSON_TIME = 20000; // 20 seconds
const PASSING_SCORE = 70;

const hybridDetectionTheoryLessons = [
  {
    title: "Introduction to Hybrid Detection",
    content: `Welcome to the world of hybrid detection - the most comprehensive approach to network security that combines the best of multiple detection methodologies.

Hybrid detection systems represent the evolution of cybersecurity, integrating signature-based detection with anomaly-based detection to create a robust, multi-layered defense mechanism. This approach addresses the limitations of single-method systems while maximizing their strengths.

**Watch:**
[Understanding Hybrid Detection Systems](https://www.youtube.com/watch?v=8QnSpdYl2nQ)

**Key Points:**
- Combines multiple detection techniques for comprehensive coverage
- Addresses limitations of individual detection methods
- Provides layered security architecture
- Adapts to evolving threat landscapes
- Balances accuracy with efficiency

**Try it:**
> Think about your home security system - how does it use multiple sensors (motion, door/window, cameras) to provide better protection than any single sensor alone?

**Quiz:**
- What is the primary goal of hybrid detection systems?
  - A) To replace all other detection methods
  - B) To combine strengths while minimizing weaknesses
  - C) To make detection faster
  - D) To reduce system costs`
  },
  {
    title: "Core Components and Architecture",
    content: `Hybrid detection systems are built on sophisticated architectures that seamlessly integrate multiple detection engines. Understanding these components is crucial for effective implementation.

**Primary Components:**

**1. Signature-Based Engine**
- Maintains comprehensive signature databases
- Performs pattern matching and rule-based detection
- Provides rapid identification of known threats

**2. Anomaly-Based Engine**
- Establishes behavioral baselines
- Monitors for statistical deviations
- Detects unknown and zero-day threats

**3. Correlation Engine**
- Combines alerts from multiple sources
- Reduces false positives through intelligent filtering
- Provides context-aware threat assessment

**Diagram:**
Network Traffic → Parallel Processing
                ↓                ↓
    Signature Engine    Anomaly Engine
                ↓                ↓
         Known Threats    Unknown Threats
                ↓                ↓
            Correlation Engine
                    ↓
            Final Assessment

**Interactive:**
- Which component do you think is most critical for detecting advanced persistent threats (APTs)?

**Example:**
A hybrid IDS monitoring a corporate network simultaneously runs signature matching against 50,000 known malware patterns while analyzing user behavior patterns to detect insider threats that have no known signatures.`
  },
  {
    title: "Detection Methodologies Integration",
    content: `The power of hybrid detection lies in how different methodologies are integrated to work together harmoniously, each contributing unique capabilities to the overall security posture.

**Integration Approaches:**

**Sequential Processing**
- First stage: Signature-based detection
- Second stage: Anomaly detection on unmatched traffic
- Advantage: Resource efficiency
- Disadvantage: Potential delays

**Parallel Processing**
- Simultaneous execution of all detection engines
- Real-time correlation of results
- Advantage: Speed and comprehensive coverage
- Disadvantage: Higher resource requirements

**Hierarchical Processing**
- Primary screening with fast methods
- Detailed analysis with sophisticated techniques
- Adaptive resource allocation
- Optimizes both speed and accuracy

**Try it:**
> Consider email security - how might a hybrid system process incoming emails using multiple detection methods?

**Best Practices:**
- Balance speed and accuracy requirements
- Consider available computational resources
- Plan for scalability and future expansion
- Implement proper alert prioritization

**Quiz:**
- In parallel processing, what is the main trade-off?
  - A) Accuracy vs. Speed
  - B) Resources vs. Coverage  
  - C) Cost vs. Efficiency
  - D) Complexity vs. Simplicity`
  },
  {
    title: "Advantages and Benefits",
    content: `Hybrid detection systems offer compelling advantages that make them the preferred choice for comprehensive network security in modern environments.

**Primary Advantages:**

**Enhanced Detection Coverage**
- Combines known threat detection with unknown threat discovery
- Reduces blind spots in security monitoring
- Provides comprehensive threat landscape visibility

**Improved Accuracy**
- Reduces false positives through correlation
- Minimizes false negatives via multiple detection layers
- Provides context-aware threat assessment

**Adaptive Response**
- Automatically adjusts to new threat patterns
- Learns from combined detection experiences
- Evolves with the threat landscape

**Operational Efficiency**
- Optimizes resource utilization across engines
- Provides centralized alert management
- Streamlines security operations workflows

**Interactive:**
- How do you think hybrid detection helps with the challenge of alert fatigue in security operations centers?

**Example:**
A financial institution's hybrid system detected a sophisticated fraud attempt that used legitimate user credentials (bypassing signature detection) but exhibited unusual transaction patterns (caught by anomaly detection). Neither method alone would have identified this threat.

**Key Benefits:**
- 40-60% reduction in false positives
- 25-35% improvement in threat detection rates
- Significant reduction in mean time to detection (MTTD)
- Enhanced security analyst productivity

**Quiz:**
- What percentage reduction in false positives can hybrid systems typically achieve?
  - A) 10-20%
  - B) 25-35%
  - C) 40-60%
  - D) 70-80%`
  },
  {
    title: "Implementation Strategies",
    content: `Successful implementation of hybrid detection systems requires careful planning, strategic decision-making, and understanding of various deployment approaches.

**Deployment Models:**

**1. Unified Platform Approach**
- Single integrated solution
- Consistent management interface
- Simplified administration
- Optimized resource sharing

**2. Multi-Vendor Integration**
- Best-of-breed component selection
- Flexible vendor relationships
- Potential integration challenges
- Requires sophisticated orchestration

**3. Phased Implementation**
- Gradual deployment approach
- Risk mitigation through staged rollout
- Allows for learning and adjustment
- Maintains operational continuity

**Implementation Considerations:**

**Technical Requirements**
- Network architecture assessment
- Bandwidth and latency analysis
- Storage and processing capacity planning
- Integration point identification

**Organizational Factors**
- Staff training and skill development
- Change management processes
- Budget and resource allocation
- Timeline and milestone planning

**Try it:**
> If you were implementing a hybrid detection system for a medium-sized company, which deployment model would you choose and why?

**Best Practices:**
- Start with pilot programs in non-critical environments
- Establish clear success metrics and KPIs
- Plan for scalability from the beginning
- Ensure proper documentation and procedures

**Diagram:**
Planning Phase → Pilot Deployment → Evaluation
      ↓                ↓              ↓
Requirements → Testing/Tuning → Full Deployment
      ↓                ↓              ↓
Architecture → Optimization → Ongoing Management

**Quiz:**
- What is the primary advantage of phased implementation?
  - A) Lower initial costs
  - B) Risk mitigation and learning
  - C) Faster deployment
  - D) Better vendor relationships`
  },
  {
    title: "Challenges and Solutions",
    content: `While hybrid detection systems offer significant benefits, they also present unique challenges that must be carefully addressed for successful implementation and operation.

**Major Challenges:**

**Challenge: Complexity Management**
Managing multiple detection engines, correlation rules, and alert streams can become overwhelming without proper organization.

**Solution: Unified Management Platform**
- Implement centralized dashboard and control systems
- Standardize reporting and alert formats
- Automate routine management tasks
- Provide comprehensive visualization tools

**Challenge: Resource Optimization**
Running multiple detection engines simultaneously can strain computational resources and impact network performance.

**Solution: Intelligent Resource Allocation**
- Implement dynamic load balancing
- Use adaptive sampling techniques
- Optimize detection engine scheduling
- Deploy hardware acceleration where appropriate

**Challenge: Alert Correlation**
Combining alerts from multiple sources can lead to information overload and decision paralysis.

**Solution: Advanced Correlation Algorithms**
- Implement machine learning-based correlation
- Use time-window and pattern-based grouping
- Apply risk-based alert prioritization
- Provide contextual threat intelligence

**Challenge: False Positive Management**
Multiple detection methods might increase overall false positive rates if not properly tuned.

**Solution: Smart Filtering and Context Analysis**
- Implement behavioral baselines for filtering
- Use threat intelligence for context
- Apply machine learning for pattern recognition
- Establish feedback loops for continuous improvement

**Try it:**
> Think of a real-world scenario where you had to make decisions using multiple, sometimes conflicting, sources of information. How did you resolve the conflicts?

**Interactive:**
- Which challenge do you think would be most difficult to address in a large enterprise environment?

**Quiz:**
- What is the most effective approach to managing alert correlation complexity?
  - A) Hiring more analysts
  - B) Advanced correlation algorithms
  - C) Reducing detection sensitivity
  - D) Manual alert review processes`
  },
  {
    title: "Performance Optimization",
    content: `Optimizing hybrid detection systems requires a deep understanding of performance characteristics, bottlenecks, and tuning strategies to achieve optimal security effectiveness.

**Performance Metrics:**

**Detection Effectiveness**
- True Positive Rate (Sensitivity)
- False Positive Rate
- Detection Coverage
- Mean Time to Detection (MTTD)

**System Performance**
- Throughput (packets/events per second)
- Latency (detection delay)
- Resource utilization (CPU, memory, storage)
- Scalability characteristics

**Optimization Strategies:**

**1. Engine Coordination**
- Optimize detection engine sequencing
- Implement intelligent load distribution
- Use predictive resource allocation
- Balance accuracy vs. performance trade-offs

**2. Data Flow Optimization**
- Implement efficient data pipelines
- Use streaming processing architectures
- Optimize storage and retrieval operations
- Minimize data movement overhead

**3. Algorithm Tuning**
- Adjust detection thresholds dynamically
- Optimize signature matching algorithms
- Fine-tune anomaly detection parameters
- Implement adaptive learning rates

**Example:**
A large ISP optimized their hybrid detection system by implementing intelligent traffic sampling, reducing processing load by 60% while maintaining 95% detection accuracy for critical threats.

**Diagram:**
Traffic Input → Intelligent Sampling → Parallel Engines
      ↓              ↓                    ↓
Performance → Load Balancing → Result Correlation
   Metrics           ↓                    ↓
      ↓         Resource Management → Final Output
Optimization
 Feedback

**Best Practices:**
- Establish performance baselines before optimization
- Use A/B testing for configuration changes
- Monitor performance continuously
- Implement automated performance tuning

**Quiz:**
- What is the most important performance metric for hybrid detection systems?
  - A) Processing speed only
  - B) Detection accuracy only
  - C) Balance of speed and accuracy
  - D) Resource utilization only`
  },
  {
    title: "Real-World Applications",
    content: `Hybrid detection systems have proven their value across diverse industries and use cases, demonstrating their versatility and effectiveness in real-world security scenarios.

**Industry Applications:**

**Financial Services**
Financial institutions use hybrid detection to protect against fraud, insider threats, and advanced persistent threats targeting financial data.

*Case Study:* A major bank implemented hybrid detection to monitor trading systems, combining signature-based detection for known fraud patterns with anomaly detection for unusual trading behaviors. Result: 45% reduction in fraudulent transactions and 30% faster threat detection.

**Healthcare**
Healthcare organizations leverage hybrid systems to protect patient data while ensuring compliance with regulations like HIPAA.

*Application:* Detecting unauthorized access to electronic health records while monitoring for data exfiltration attempts and insider threats.

**Manufacturing (Industry 4.0)**
Industrial control systems and IoT devices in manufacturing environments require specialized hybrid detection approaches.

*Focus Areas:* OT network security, supply chain protection, and intellectual property theft prevention.

**Government and Defense**
Critical infrastructure protection and national security applications require the most sophisticated hybrid detection implementations.

*Requirements:* Real-time threat detection, classified data protection, and advanced persistent threat identification.

**E-commerce and Retail**
Online retailers use hybrid detection to protect customer data, prevent fraud, and ensure business continuity.

**Interactive:**
- Which industry do you think would benefit most from hybrid detection systems and why?

**Common Use Cases:**
- Advanced Persistent Threat (APT) detection
- Insider threat monitoring
- Compliance and regulatory requirements
- Business continuity protection
- Intellectual property protection

**Try it:**
> Consider your own organization or school - how could a hybrid detection system help protect its most valuable digital assets?

**Quiz:**
- In which sector is hybrid detection most critical for national security?
  - A) Retail
  - B) Entertainment
  - C) Government and Defense
  - D) Sports`
  },
  {
    title: "Integration with Security Ecosystems",
    content: `Modern hybrid detection systems don't operate in isolation - they must integrate seamlessly with existing security infrastructures and complement other security tools and processes.

**Security Ecosystem Components:**

**SIEM Integration**
Security Information and Event Management systems serve as central hubs for hybrid detection output.

- Centralized log aggregation and correlation
- Long-term security event storage
- Compliance reporting and auditing
- Integration with incident response workflows

**SOAR Integration**
Security Orchestration, Automation, and Response platforms enhance hybrid detection capabilities.

- Automated threat response actions
- Workflow orchestration and case management
- Integration with external threat intelligence
- Playbook-driven incident handling

**Threat Intelligence Platforms**
External threat intelligence enhances detection accuracy and provides context.

- IOC (Indicators of Compromise) integration
- Threat actor behavior patterns
- Global threat landscape awareness
- Attribution and campaign tracking

**Example:**
A multinational corporation integrated their hybrid detection system with their SIEM, SOAR, and threat intelligence platforms, creating an automated response capability that reduced mean time to response (MTTR) from 4 hours to 15 minutes.

**Integration Benefits:**
- Enhanced detection context and accuracy
- Automated response and remediation
- Improved analyst productivity
- Comprehensive security visibility

**Diagram:**
Hybrid Detection System
         ↓
    Alert Generation
         ↓
   SIEM Aggregation ← Threat Intelligence
         ↓
   Correlation Analysis
         ↓
   SOAR Orchestration
         ↓
   Automated Response

**Best Practices:**
- Standardize data formats and APIs
- Implement proper access controls
- Ensure scalable integration architecture
- Plan for future technology evolution

**Interactive:**
- How do you think AI and machine learning will change the integration landscape for hybrid detection systems?

**Quiz:**
- What is the primary benefit of integrating hybrid detection with SOAR platforms?
  - A) Better detection accuracy
  - B) Automated response capabilities
  - C) Lower costs
  - D) Simpler management`
  },
  {
    title: "Compliance and Regulatory Considerations",
    content: `Hybrid detection systems play a crucial role in helping organizations meet various compliance requirements and regulatory mandates across different industries.

**Key Regulatory Frameworks:**

**PCI DSS (Payment Card Industry)**
Hybrid detection systems help organizations protect cardholder data and meet continuous monitoring requirements.

*Requirements:* Real-time monitoring, file integrity monitoring, and network segmentation validation.

**HIPAA (Healthcare)**
Healthcare organizations use hybrid detection to protect electronic protected health information (ePHI).

*Focus Areas:* Access monitoring, data loss prevention, and breach detection capabilities.

**SOX (Sarbanes-Oxley)**
Financial reporting integrity requires comprehensive monitoring of IT systems and data access.

*Applications:* Change detection, access monitoring, and financial data protection.

**GDPR (General Data Protection Regulation)**
European privacy regulation requires organizations to detect and report data breaches within 72 hours.

*Capabilities:* Data access monitoring, breach detection, and incident response automation.

**Compliance Benefits:**

**Continuous Monitoring**
- 24/7 security monitoring capabilities
- Real-time threat detection and alerting
- Comprehensive audit trail generation
- Automated compliance reporting

**Documentation and Reporting**
- Detailed security event logging
- Regulatory report generation
- Audit trail maintenance
- Evidence collection and preservation

**Try it:**
> If you were a compliance officer, what features would you consider most important in a hybrid detection system?

**Example:**
A healthcare provider implemented hybrid detection to achieve HIPAA compliance, combining signature-based detection for known threats with anomaly detection for unusual data access patterns. The system helped them identify and report a potential data breach within the required 60-day notification period.

**Best Practices:**
- Understand specific regulatory requirements
- Implement proper data retention policies
- Ensure audit trail integrity
- Plan for regulatory reporting needs

**Quiz:**
- Which regulation requires breach notification within 72 hours?
  - A) PCI DSS
  - B) HIPAA
  - C) GDPR
  - D) SOX`
  },
  {
    title: "Future Trends and Evolution",
    content: `The future of hybrid detection systems is shaped by emerging technologies, evolving threat landscapes, and changing organizational needs. Understanding these trends is crucial for strategic planning.

**Emerging Technologies:**

**Artificial Intelligence Integration**
AI and machine learning are transforming hybrid detection capabilities.

- Advanced pattern recognition and behavioral analysis
- Automated threat hunting and investigation
- Predictive threat modeling and risk assessment
- Self-tuning detection algorithms

**Cloud-Native Architectures**
Modern hybrid detection systems are embracing cloud-native design principles.

- Microservices-based detection engines
- Container orchestration and scaling
- Serverless processing for peak loads
- Multi-cloud deployment strategies

**Edge Computing Integration**
Distributed computing brings detection capabilities closer to data sources.

- IoT device protection and monitoring
- Real-time processing at network edges
- Reduced latency and bandwidth requirements
- Improved privacy and data sovereignty

**Quantum-Resistant Security**
Preparing for the quantum computing era requires new approaches to detection.

- Post-quantum cryptographic algorithm support
- Quantum-safe communication protocols
- Advanced encryption and key management
- Future-proof security architectures

**Evolving Threat Landscape:**

**Advanced Persistent Threats (APTs)**
Sophisticated, long-term attacks require advanced detection capabilities.

**Supply Chain Attacks**
Protecting against compromised software and hardware requires comprehensive monitoring.

**Cloud and Hybrid Infrastructure Threats**
Multi-cloud and hybrid environments present new security challenges.

**Try it:**
> How do you think quantum computing will impact the effectiveness of current detection methods?

**Future Predictions:**
- Fully autonomous threat detection and response
- Seamless integration across all IT environments
- Predictive security with threat forecasting
- Zero-trust architecture native integration

**Interactive:**
- Which emerging technology do you think will have the greatest impact on hybrid detection systems?

**Example:**
A technology company is piloting an AI-enhanced hybrid detection system that uses machine learning to automatically adjust detection parameters based on threat intelligence feeds, reducing false positives by 70% while improving unknown threat detection by 40%.

**Quiz:**
- What is expected to be the most significant driver of hybrid detection evolution?
  - A) Cost reduction
  - B) Artificial Intelligence integration
  - C) Regulatory requirements
  - D) Hardware improvements`
  }
];

// Enhanced interactive components
const WatchBlock = ({ url }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xl">🎬</span>
      <span className="font-semibold text-blue-800">Watch & Learn</span>
    </div>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline hover:text-blue-900 transition-colors duration-200 font-medium"
    >
      Click here to watch a short video introduction
    </a>
  </div>
);

const TryItBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className="flex items-center gap-2 font-semibold text-yellow-800 bg-gradient-to-r from-yellow-100 to-yellow-200 px-4 py-2 rounded-lg hover:from-yellow-200 hover:to-yellow-300 transition-all duration-200 shadow-sm glass-effect"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl">💡</span>
        Try it {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 rounded-lg shadow-sm glass-effect animate-fadeIn">
          <div className="text-gray-800 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
};

const QuizBlock = ({ question }) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    
    // Improved quiz logic for hybrid detection questions
    if (question.toLowerCase().includes('primary goal')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! The primary goal is to combine strengths while minimizing weaknesses of individual detection methods.');
      } else {
        setFeedback('❌ Incorrect. The main goal is to combine the strengths of different detection methods.');
      }
    } else if (question.toLowerCase().includes('trade-off')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! Parallel processing trades higher resource usage for comprehensive coverage.');
      } else {
        setFeedback('❌ Try again. Think about what parallel processing requires more of.');
      }
    } else if (question.toLowerCase().includes('false positives')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! Hybrid systems typically achieve 40-60% reduction in false positives.');
      } else {
        setFeedback('❌ Try again. Hybrid systems are quite effective at reducing false positives.');
      }
    } else if (question.toLowerCase().includes('phased implementation')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! Phased implementation allows for risk mitigation and learning.');
      } else {
        setFeedback('❌ Try again. Think about why gradual deployment might be beneficial.');
      }
    } else if (question.toLowerCase().includes('correlation complexity')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! Advanced correlation algorithms are key to managing complexity.');
      } else {
        setFeedback('❌ Try again. Think about what can help process multiple alert sources intelligently.');
      }
    } else if (question.toLowerCase().includes('performance metric')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! The balance of speed and accuracy is most important.');
      } else {
        setFeedback('❌ Try again. Think about what matters most in detection systems.');
      }
    } else if (question.toLowerCase().includes('national security')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! Government and Defense sector is most critical for national security.');
      } else {
        setFeedback('❌ Try again. Which sector would be most important for protecting national interests?');
      }
    } else if (question.toLowerCase().includes('soar platforms')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! SOAR integration provides automated response capabilities.');
      } else {
        setFeedback('❌ Try again. Think about what SOAR stands for and its main purpose.');
      }
    } else if (question.toLowerCase().includes('72 hours')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! GDPR requires breach notification within 72 hours.');
      } else {
        setFeedback('❌ Try again. Which European regulation has this strict notification requirement?');
      }
    } else if (question.toLowerCase().includes('significant driver')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! AI integration is expected to be the most significant driver of evolution.');
      } else {
        setFeedback('❌ Try again. Think about which technology is transforming cybersecurity most dramatically.');
      }
    } else {
      setFeedback('✅ Answer submitted! Great thinking!');
    }
  };
  
  return (
    <div className="my-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg shadow-sm glass-effect">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧠</span>
        <span className="font-semibold text-green-800">Knowledge Check</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="text-gray-800 font-medium">{question}</div>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          placeholder="Type your answer (A, B, C, or D)..."
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitted || !answer.trim()}
        >
          Submit Answer
        </button>
        {feedback && (
          <div className="text-green-700 font-medium mt-2 p-2 bg-white rounded border border-green-200">
            {feedback}
          </div>
        )}
      </form>
    </div>
  );
};

const DiagramBlock = ({ children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">📊</span>
      <span className="font-semibold text-indigo-800">Process Diagram</span>
    </div>
    <pre className="font-mono text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded border border-indigo-200">
      {children}
    </pre>
  </div>
);

const ExampleBlock = ({ children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">💼</span>
      <span className="font-semibold text-gray-800">Real-World Example</span>
    </div>
    <div className="text-gray-800 leading-relaxed">{children}</div>
  </div>
);

const InteractiveBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className="flex items-center gap-2 font-semibold text-purple-800 bg-gradient-to-r from-purple-100 to-purple-200 px-4 py-2 rounded-lg hover:from-purple-200 hover:to-purple-300 transition-all duration-200 shadow-sm glass-effect"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl">⚡</span>
        Interactive {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 rounded-lg shadow-sm glass-effect animate-fadeIn">
          <div className="text-gray-800 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
};

const KeyPointsBlock = ({ points }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-cyan-50 to-teal-50 border-l-4 border-cyan-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🔑</span>
      <span className="font-semibold text-cyan-800">Key Points</span>
    </div>
    <ul className="space-y-2">
      {points.map((point, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="text-cyan-600 mt-1">•</span>
          <span className="leading-relaxed">{point}</span>
        </li>
      ))}
    </ul>
  </div>
);

const BestPracticesBlock = ({ practices }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">✅</span>
      <span className="font-semibold text-emerald-800">Best Practices</span>
    </div>
    <ul className="space-y-2">
      {practices.map((practice, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="text-emerald-600 mt-1">•</span>
          <span className="leading-relaxed">{practice}</span>
        </li>
      ))}
    </ul>
  </div>
);

// Enhanced lesson content parser
function renderLessonContent(content) {
  const blocks = content.split(/\n\n+/);
  
  return blocks.map((block, idx) => {
    // Watch block
    if (/\*\*Watch:?\*\*/i.test(block) || block.startsWith('**Watch')) {
      const match = block.match(/\((https?:[^)]+)\)/);
      return <WatchBlock key={idx} url={match ? match[1] : '#'} />;
    }
    
    // Try it block
    if (/\*\*Try it:?\*\*/i.test(block) || block.startsWith('**Try it')) {
      const text = block.replace(/\*\*Try it:?\*\*/i, '').replace(/^>\s*/, '').trim();
      return <TryItBlock key={idx}>{text}</TryItBlock>;
    }
    
    // Quiz block
    if (/\*\*Quiz:?\*\*/i.test(block) || block.startsWith('**Quiz')) {
      const text = block.replace(/\*\*Quiz:?\*\*/i, '').replace(/^-\s*/, '').trim();
      return <QuizBlock key={idx} question={text} />;
    }
    
    // Diagram block
    if (/\*\*Diagram:?\*\*/i.test(block) || block.startsWith('**Diagram')) {
      const text = block.replace(/\*\*Diagram:?\*\*/i, '').trim();
      return <DiagramBlock key={idx}>{text}</DiagramBlock>;
    }
    
    // Example block
    if (/\*\*Example:?\*\*/i.test(block) || block.startsWith('**Example')) {
      const text = block.replace(/\*\*Example:?\*\*/i, '').trim();
      return <ExampleBlock key={idx}>{text}</ExampleBlock>;
    }
    
    // Interactive block
    if (/\*\*Interactive:?\*\*/i.test(block) || block.startsWith('**Interactive')) {
      const text = block.replace(/\*\*Interactive:?\*\*/i, '').trim();
      return <InteractiveBlock key={idx}>{text}</InteractiveBlock>;
    }
    
    // Key Points block
    if (/\*\*Key Points:?\*\*/i.test(block) || block.startsWith('**Key Points')) {
      const lines = block.split('\n').slice(1).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return <KeyPointsBlock key={idx} points={lines} />;
    }
    
    // Best Practices block
    if (/\*\*Best Practices:?\*\*/i.test(block) || block.startsWith('**Best Practices')) {
      const lines = block.split('\n').slice(1).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return <BestPracticesBlock key={idx} practices={lines} />;
    }
    
    // Challenge/Solution blocks
    if (block.includes('**Challenge:') || block.includes('**Solution:')) {
      return (
        <div key={idx} className="my-4 p-4 bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg shadow-sm glass-effect">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <span className="font-semibold text-orange-800">Challenge & Solution</span>
          </div>
          <div className="prose prose-sm max-w-none text-orange-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
          </div>
        </div>
      );
    }
    
    // Numbered sections (1., 2., etc.)
    if (/^\*\*\d+\./.test(block)) {
      return (
        <div key={idx} className="my-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400 rounded-lg shadow-sm glass-effect">
          <div className="prose prose-lg max-w-none text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
          </div>
        </div>
      );
    }
    
    // Default: markdown with enhanced styling
    return (
      <div key={idx} className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
      </div>
    );
  });
}

const HybridDetection = () => {
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [lessonTimers, setLessonTimers] = useState({});
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  const [lessonStartTime, setLessonStartTime] = useState(Date.now());
  const [readingProgress, setReadingProgress] = useState(0);
  const lessonContentRef = useRef(null);
  
  const currentLesson = hybridDetectionTheoryLessons[currentLessonIdx];
  
  const assessmentQuestions = [
    {
      question: "What is the main advantage of hybrid detection over single-method approaches?",
      options: [
        "It's faster than other methods",
        "It combines strengths of multiple detection techniques",
        "It requires less computational resources",
        "It only detects known threats"
      ],
      correct: 1
    },
    {
      question: "Which two detection methods does hybrid detection typically combine?",
      options: [
        "Signature-based and heuristic-based",
        "Anomaly-based and behavioral-based", 
        "Signature-based and anomaly-based",
        "Protocol-based and content-based"
      ],
      correct: 2
    },
    {
      question: "What is a key challenge in implementing hybrid detection systems?",
      options: [
        "Limited threat detection capability",
        "Resource management and alert correlation",
        "Only works with known signatures",
        "Cannot detect zero-day attacks"
      ],
      correct: 1
    },
    {
      question: "What percentage reduction in false positives can hybrid systems typically achieve?",
      options: [
        "10-20%",
        "25-35%",
        "40-60%",
        "70-80%"
      ],
      correct: 2
    },
    {
      question: "Which integration approach offers the best balance of speed and comprehensive coverage?",
      options: [
        "Sequential processing only",
        "Parallel processing with correlation",
        "Manual analysis only",
        "Signature-based detection only"
      ],
      correct: 1
    }
  ];

  useEffect(() => {
    setLessonStartTime(Date.now());
    setReadingProgress(0);
  }, [currentLessonIdx]);

  // Scroll tracking for reading progress
  useEffect(() => {
    const handleScroll = () => {
      if (lessonContentRef.current) {
        const element = lessonContentRef.current;
        const scrollTop = window.scrollY;
        const elementTop = element.offsetTop;
        const elementHeight = element.scrollHeight;
        const windowHeight = window.innerHeight;
        
        const scrolled = Math.max(0, scrollTop - elementTop + windowHeight);
        const progress = Math.min(100, (scrolled / elementHeight) * 100);
        
        setReadingProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentLessonIdx]);

  const handleNextLesson = () => {
    const timeSpent = Date.now() - lessonStartTime;
    const lessonKey = `lesson-${currentLessonIdx}`;
    
    setLessonTimers(prev => ({
      ...prev,
      [lessonKey]: timeSpent
    }));

    if (timeSpent < MIN_LESSON_TIME) {
      alert(`Please spend at least ${MIN_LESSON_TIME / 1000} seconds reading this lesson to ensure proper understanding.`);
      return;
    }

    if (currentLessonIdx < hybridDetectionTheoryLessons.length - 1) {
      setCurrentLessonIdx(currentLessonIdx + 1);
    } else {
      setShowAssessment(true);
    }
  };

  const handlePreviousLesson = () => {
    if (currentLessonIdx > 0) {
      setCurrentLessonIdx(currentLessonIdx - 1);
    }
  };

  const handleAssessmentSubmit = () => {
    let correct = 0;
    assessmentQuestions.forEach((q, idx) => {
      if (assessmentAnswers[idx] === q.correct) {
        correct++;
      }
    });
    const score = Math.round((correct / assessmentQuestions.length) * 100);
    setAssessmentScore(score);

    // Submit progress
    const user = JSON.parse(localStorage.getItem('student_user') || '{}');
    if (user.id) {
      const progressData = {
        studentId: user.id,
        moduleName: 'Hybrid Detection',
        lessonTitle: 'Assessment Complete',
        completed: score >= PASSING_SCORE,
        timeSpent: Object.values(lessonTimers).reduce((sum, time) => sum + time, 0),
        engagementScore: Math.min(100, readingProgress + (score >= PASSING_SCORE ? 20 : 0))
      };
      
      fetch('http://localhost:8000/student/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      }).catch(console.error);
    }
  };

  if (showAssessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex">
        <main className="flex-1 min-h-screen flex justify-center">
          <div className="max-w-7xl w-full p-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 glass-effect">
              <h2 className="text-2xl font-bold text-[#1E5780] mb-6">Assessment: Hybrid Detection</h2>
              
              {assessmentScore === null ? (
                <div className="space-y-6">
                  {assessmentQuestions.map((q, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                      <p className="font-medium mb-3">{q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((option, optIdx) => (
                          <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`q${idx}`}
                              value={optIdx}
                              onChange={(e) => setAssessmentAnswers(prev => ({
                                ...prev,
                                [idx]: parseInt(e.target.value)
                              }))}
                              className="text-[#1E5780]"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={handleAssessmentSubmit}
                    className="px-6 py-3 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors font-medium"
                    disabled={Object.keys(assessmentAnswers).length < assessmentQuestions.length}
                  >
                    Submit Assessment
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className={`text-6xl font-bold ${assessmentScore >= PASSING_SCORE ? 'text-green-600' : 'text-red-600'}`}>
                    {assessmentScore}%
                  </div>
                  <div className={`text-xl ${assessmentScore >= PASSING_SCORE ? 'text-green-700' : 'text-red-700'}`}>
                    {assessmentScore >= PASSING_SCORE ? 'Congratulations! You passed!' : 'Keep studying and try again!'}
                  </div>
                  <Link
                    to="/student/learning-modules"
                    className="inline-block px-6 py-3 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors font-medium"
                  >
                    Back to Modules
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex">
      <main className="flex-1 min-h-screen flex justify-center">
  <div className="max-w-7xl w-full p-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 glass-effect">
            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Lesson {currentLessonIdx + 1} of {hybridDetectionTheoryLessons.length}
                </span>
                <span className="text-sm text-gray-600">
                  {Math.round(readingProgress)}% read
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#1E5780] to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentLessonIdx + 1) / hybridDetectionTheoryLessons.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-[#1E5780] mb-2">Hybrid Detection</h1>
            <h2 className="text-xl text-gray-700 mb-6">{currentLesson.title}</h2>

            <div ref={lessonContentRef} className="prose prose-lg max-w-none mb-8">
              {renderLessonContent(currentLesson.content)}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <button
                onClick={handlePreviousLesson}
                disabled={currentLessonIdx === 0}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Lesson {currentLessonIdx + 1} of {hybridDetectionTheoryLessons.length}
              </span>
              
              <button
                onClick={handleNextLesson}
                className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
              >
                {currentLessonIdx === hybridDetectionTheoryLessons.length - 1 ? 'Take Assessment' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HybridDetection;
