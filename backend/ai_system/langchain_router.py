"""
File Location: testlab/backend/ai_system/langchain_router.py

LangChain-based AI Router for TestLab
Configurable keyword routing system for optimal LLM selection
"""

import os
import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging
from enum import Enum

# LangChain imports
from langchain.chat_models import ChatOpenAI, ChatAnthropic
from langchain.llms import Cohere, Together, HuggingFaceHub
from langchain.chains import LLMChain, ConversationChain
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.agents import initialize_agent, Tool, AgentType
from langchain.callbacks import CallbackManager, StreamingStdOutCallbackHandler
from langchain.schema import BaseMessage, HumanMessage, AIMessage
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMType(Enum):
    """Supported LLM types"""
    OPENAI_GPT4 = "openai_gpt4"
    OPENAI_GPT35 = "openai_gpt35"
    CLAUDE_3 = "claude_3"
    CLAUDE_2 = "claude_2"
    LLAMA_70B = "llama_70b"
    LLAMA_13B = "llama_13b"
    COHERE = "cohere"
    MISTRAL = "mistral"

@dataclass
class RoutingConfig:
    """Configuration for keyword-based routing"""
    keywords: List[str]
    primary_llm: LLMType
    secondary_llms: List[LLMType] = field(default_factory=list)
    weight: float = 1.0
    context_keywords: List[str] = field(default_factory=list)
    min_confidence: float = 0.7
    
class KeywordRouter:
    """Advanced keyword-based routing system"""
    
    def __init__(self, config_path: str = "./config/routing_config.yaml"):
        self.config_path = Path(config_path)
        self.routing_rules = self._load_routing_config()
        self.keyword_cache = {}
        
    def _load_routing_config(self) -> Dict[str, RoutingConfig]:
        """Load routing configuration from YAML file"""
        if not self.config_path.exists():
            # Create default configuration
            self._create_default_config()
        
        with open(self.config_path, 'r') as f:
            config_data = yaml.safe_load(f)
        
        routing_rules = {}
        for category, rules in config_data['routing_rules'].items():
            routing_rules[category] = RoutingConfig(
                keywords=rules['keywords'],
                primary_llm=LLMType(rules['primary_llm']),
                secondary_llms=[LLMType(llm) for llm in rules.get('secondary_llms', [])],
                weight=rules.get('weight', 1.0),
                context_keywords=rules.get('context_keywords', []),
                min_confidence=rules.get('min_confidence', 0.7)
            )
        
        return routing_rules
    
    def _create_default_config(self):
        """Create default routing configuration"""
        default_config = {
            'routing_rules': {
                'unit_testing': {
                    'keywords': [],
                    'primary_llm': 'openai_gpt4',
                    'secondary_llms': ['claude_3'],
                    'weight': 1.0,
                    'context_keywords': [],
                    'min_confidence': 0.8
                },
                'integration_testing': {
                    'keywords': [],
                    'primary_llm': 'claude_3',
                    'secondary_llms': ['openai_gpt4'],
                    'weight': 0.9,
                    'context_keywords': [],
                    'min_confidence': 0.75
                },
                'e2e_testing': {
                    'keywords': [],
                    'primary_llm': 'openai_gpt4',
                    'secondary_llms': ['claude_2'],
                    'weight': 0.95,
                    'context_keywords': [],
                    'min_confidence': 0.8
                },
                'performance_testing': {
                    'keywords': [],
                    'primary_llm': 'openai_gpt4',
                    'secondary_llms': ['llama_70b'],
                    'weight': 0.85,
                    'context_keywords': [],
                    'min_confidence': 0.7
                },
                'security_testing': {
                    'keywords': [],
                    'primary_llm': 'claude_3',
                    'secondary_llms': ['openai_gpt4'],
                    'weight': 1.0,
                    'context_keywords': [],
                    'min_confidence': 0.9
                },
                'accessibility_testing': {
                    'keywords': [],
                    'primary_llm': 'claude_2',
                    'secondary_llms': ['openai_gpt35'],
                    'weight': 0.8,
                    'context_keywords': [],
                    'min_confidence': 0.75
                },
                'code_review': {
                    'keywords': [],
                    'primary_llm': 'openai_gpt4',
                    'secondary_llms': ['claude_3'],
                    'weight': 0.9,
                    'context_keywords': [],
                    'min_confidence': 0.8
                },
                'debugging': {
                    'keywords': [],
                    'primary_llm': 'claude_3',
                    'secondary_llms': ['openai_gpt4'],
                    'weight': 0.95,
                    'context_keywords': [],
                    'min_confidence': 0.85
                }
            },
            'llm_configurations': {
                'openai_gpt4': {
                    'model': 'gpt-4',
                    'temperature': 0.2,
                    'max_tokens': 2000
                },
                'openai_gpt35': {
                    'model': 'gpt-3.5-turbo',
                    'temperature': 0.3,
                    'max_tokens': 1500
                },
                'claude_3': {
                    'model': 'claude-3-opus-20240229',
                    'temperature': 0.2,
                    'max_tokens': 2000
                },
                'claude_2': {
                    'model': 'claude-2.1',
                    'temperature': 0.3,
                    'max_tokens': 1500
                },
                'llama_70b': {
                    'model': 'meta-llama/Llama-2-70b-chat-hf',
                    'temperature': 0.2,
                    'max_tokens': 1500
                }
            }
        }
        
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, 'w') as f:
            yaml.dump(default_config, f, default_flow_style=False)
    
    def route(self, query: str, context: Optional[str] = None) -> Tuple[str, RoutingConfig, float]:
        """Route query to appropriate LLM category based on keywords"""
        query_lower = query.lower()
        scores = {}
        
        for category, config in self.routing_rules.items():
            score = 0.0
            
            # Check primary keywords
            for keyword in config.keywords:
                if keyword in query_lower:
                    score += config.weight
            
            # Check context keywords if context provided
            if context and config.context_keywords:
                context_lower = context.lower()
                for keyword in config.context_keywords:
                    if keyword in context_lower:
                        score += config.weight * 0.5
            
            scores[category] = score
        
        # Get best match
        if scores:
            best_category = max(scores, key=scores.get)
            confidence = scores[best_category] / (len(self.routing_rules[best_category].keywords) * self.routing_rules[best_category].weight) if self.routing_rules[best_category].keywords else 0.5
            
            if confidence >= self.routing_rules[best_category].min_confidence:
                return best_category, self.routing_rules[best_category], confidence
        
        # Default fallback
        return 'general', self.routing_rules.get('general', list(self.routing_rules.values())[0]), 0.5
    
    def update_keywords(self, category: str, keywords: List[str], append: bool = True):
        """Update keywords for a category"""
        if category in self.routing_rules:
            if append:
                self.routing_rules[category].keywords.extend(keywords)
            else:
                self.routing_rules[category].keywords = keywords
            
            # Save updated configuration
            self._save_config()
    
    def _save_config(self):
        """Save current configuration to file"""
        config_data = {
            'routing_rules': {},
            'llm_configurations': {}
        }
        
        for category, config in self.routing_rules.items():
            config_data['routing_rules'][category] = {
                'keywords': config.keywords,
                'primary_llm': config.primary_llm.value,
                'secondary_llms': [llm.value for llm in config.secondary_llms],
                'weight': config.weight,
                'context_keywords': config.context_keywords,
                'min_confidence': config.min_confidence
            }
        
        with open(self.config_path, 'w') as f:
            yaml.dump(config_data, f, default_flow_style=False)

class LangChainTestingSystem:
    """Main LangChain-based testing system with keyword routing"""
    
    def __init__(self, config_dir: str = "./config", data_dir: str = "./data"):
        self.config_dir = Path(config_dir)
        self.data_dir = Path(data_dir)
        self.config_dir.mkdir(exist_ok=True)
        self.data_dir.mkdir(exist_ok=True)
        
        # Initialize components
        self.router = KeywordRouter(self.config_dir / "routing_config.yaml")
        self.api_keys = self._load_api_keys()
        self.models = self._initialize_models()
        self.chains = self._initialize_chains()
        self.memory = ConversationBufferMemory()
        self.conversation_history = []
        
        logger.info(f"Initialized LangChain Testing System with {len(self.models)} models")
    
    def _load_api_keys(self) -> Dict[str, str]:
        """Load API keys from existing TestLab data volume"""
        # First, try to load from the existing TestLab database/storage
        api_keys = {}
        
        # Check for existing keys in the shared /data volume
        existing_keys_locations = [
            Path("/data/api_keys.json"),  # Docker volume mount
            self.data_dir / "api_keys.json",  # Local data directory
            Path("./data/api_keys.json"),  # Relative path
            Path("../data/api_keys.json"),  # Parent directory
        ]
        
        for keys_path in existing_keys_locations:
            if keys_path.exists():
                try:
                    with open(keys_path, 'r') as f:
                        loaded_keys = json.load(f)
                        api_keys.update(loaded_keys)
                        logger.info(f"Loaded API keys from {keys_path}")
                        break
                except Exception as e:
                    logger.error(f"Error loading keys from {keys_path}: {e}")
        
        # If no keys found in files, try to load from TestLab database
        if not api_keys:
            api_keys = self._load_keys_from_testlab_db()
        
        # Map TestLab key names to standard names if needed
        key_mapping = {
            'OPENAI_API_KEY': 'openai',
            'ANTHROPIC_API_KEY': 'anthropic',
            'TOGETHER_AI_API_KEY': 'together',
            'COHERE_API_KEY': 'cohere',
            'claude_api_key': 'anthropic',
            'chatgpt_api_key': 'openai',
            'llama_api_key': 'together'
        }
        
        # Normalize keys
        normalized_keys = {}
        for key, value in api_keys.items():
            normalized_key = key_mapping.get(key, key.lower())
            if value and value != 'your-api-key' and not value.startswith('your-'):
                normalized_keys[normalized_key] = value
        
        if not normalized_keys:
            logger.warning("No API keys found. Please ensure keys are available in /data volume")
            
        return normalized_keys
    
    def _load_keys_from_testlab_db(self) -> Dict[str, str]:
        """Load API keys from TestLab SQLite database"""
        api_keys = {}
        
        try:
            import sqlite3
            
            # Common TestLab database locations
            db_paths = [
                Path("./backend/testlab.db"),
                Path("./testlab.db"),
                Path("/data/testlab.db"),
                Path("../backend/testlab.db")
            ]
            
            for db_path in db_paths:
                if db_path.exists():
                    conn = sqlite3.connect(str(db_path))
                    cursor = conn.cursor()
                    
                    # Try to fetch API keys from settings or config table
                    try:
                        # Check if api_keys table exists
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'")
                        if cursor.fetchone():
                            cursor.execute("SELECT service, key FROM api_keys WHERE key IS NOT NULL")
                            for service, key in cursor.fetchall():
                                api_keys[service] = key
                        
                        # Also check settings table
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
                        if cursor.fetchone():
                            cursor.execute("SELECT key, value FROM settings WHERE key LIKE '%api_key%' OR key LIKE '%API_KEY%'")
                            for key, value in cursor.fetchall():
                                if value:
                                    api_keys[key] = value
                    
                    except sqlite3.Error as e:
                        logger.error(f"Database query error: {e}")
                    
                    finally:
                        conn.close()
                    
                    if api_keys:
                        logger.info(f"Loaded {len(api_keys)} API keys from TestLab database")
                        break
                        
        except Exception as e:
            logger.error(f"Error loading from TestLab database: {e}")
            
        return api_keys
    
    def _initialize_models(self) -> Dict[LLMType, Any]:
        """Initialize all configured LLM models"""
        models = {}
        
        # Load LLM configurations
        config_path = self.config_dir / "routing_config.yaml"
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                llm_configs = config.get('llm_configurations', {})
        else:
            llm_configs = {}
        
        # Initialize OpenAI models
        if self.api_keys.get('openai') and self.api_keys['openai'] != 'your-openai-api-key':
            try:
                models[LLMType.OPENAI_GPT4] = ChatOpenAI(
                    model=llm_configs.get('openai_gpt4', {}).get('model', 'gpt-4'),
                    temperature=llm_configs.get('openai_gpt4', {}).get('temperature', 0.2),
                    openai_api_key=self.api_keys['openai'],
                    streaming=True,
                    callbacks=[StreamingStdOutCallbackHandler()]
                )
                models[LLMType.OPENAI_GPT35] = ChatOpenAI(
                    model=llm_configs.get('openai_gpt35', {}).get('model', 'gpt-3.5-turbo'),
                    temperature=llm_configs.get('openai_gpt35', {}).get('temperature', 0.3),
                    openai_api_key=self.api_keys['openai']
                )
                logger.info("Initialized OpenAI models")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI models: {e}")
        
        # Initialize Anthropic models
        if self.api_keys.get('anthropic') and self.api_keys['anthropic'] != 'your-anthropic-api-key':
            try:
                models[LLMType.CLAUDE_3] = ChatAnthropic(
                    model=llm_configs.get('claude_3', {}).get('model', 'claude-3-opus-20240229'),
                    temperature=llm_configs.get('claude_3', {}).get('temperature', 0.2),
                    anthropic_api_key=self.api_keys['anthropic']
                )
                models[LLMType.CLAUDE_2] = ChatAnthropic(
                    model=llm_configs.get('claude_2', {}).get('model', 'claude-2.1'),
                    temperature=llm_configs.get('claude_2', {}).get('temperature', 0.3),
                    anthropic_api_key=self.api_keys['anthropic']
                )
                logger.info("Initialized Anthropic models")
            except Exception as e:
                logger.error(f"Failed to initialize Anthropic models: {e}")
        
        # Initialize Together AI models (Llama)
        if self.api_keys.get('together') and self.api_keys['together'] != 'your-together-api-key':
            try:
                models[LLMType.LLAMA_70B] = Together(
                    model=llm_configs.get('llama_70b', {}).get('model', 'meta-llama/Llama-2-70b-chat-hf'),
                    temperature=llm_configs.get('llama_70b', {}).get('temperature', 0.2),
                    together_api_key=self.api_keys['together']
                )
                logger.info("Initialized Together AI models")
            except Exception as e:
                logger.error(f"Failed to initialize Together AI models: {e}")
        
        # Initialize Cohere
        if self.api_keys.get('cohere') and self.api_keys['cohere'] != 'your-cohere-api-key':
            try:
                models[LLMType.COHERE] = Cohere(
                    model='command',
                    temperature=0.2,
                    cohere_api_key=self.api_keys['cohere']
                )
                logger.info("Initialized Cohere model")
            except Exception as e:
                logger.error(f"Failed to initialize Cohere model: {e}")
        
        return models
    
    def _initialize_chains(self) -> Dict[str, LLMChain]:
        """Initialize specialized chains for different testing scenarios"""
        chains = {}
        
        # Unit Testing Chain
        unit_test_prompt = PromptTemplate(
            input_variables=["query", "context", "language", "framework"],
            template="""You are an expert in unit testing with deep knowledge of {language} and {framework}.

Context: {context}
Query: {query}

Provide comprehensive unit testing guidance including:
1. Test structure and organization
2. Mocking and stubbing strategies
3. Edge cases to consider
4. Code coverage best practices
5. Example test cases with explanations

Focus on practical, maintainable tests that follow industry best practices."""
        )
        
        # Integration Testing Chain
        integration_test_prompt = PromptTemplate(
            input_variables=["query", "context", "components"],
            template="""You are an integration testing expert specializing in testing component interactions.

Context: {context}
Components: {components}
Query: {query}

Provide detailed integration testing guidance including:
1. Test environment setup
2. Data management strategies
3. Service virtualization approaches
4. Contract testing considerations
5. Example integration test scenarios

Ensure tests are reliable, isolated, and maintainable."""
        )
        
        # Security Testing Chain
        security_test_prompt = PromptTemplate(
            input_variables=["query", "context", "tech_stack"],
            template="""You are a security testing expert with expertise in application security and penetration testing.

Context: {context}
Technology Stack: {tech_stack}
Query: {query}

Provide comprehensive security testing guidance including:
1. OWASP Top 10 relevant vulnerabilities
2. Security test automation strategies
3. Penetration testing approaches
4. Compliance requirements
5. Remediation recommendations

Be specific to the technology stack and provide actionable advice."""
        )
        
        # Create chains for available models
        for category, config in self.router.routing_rules.items():
            if config.primary_llm in self.models:
                if category == 'unit_testing':
                    chains[category] = LLMChain(
                        llm=self.models[config.primary_llm],
                        prompt=unit_test_prompt
                    )
                elif category == 'integration_testing':
                    chains[category] = LLMChain(
                        llm=self.models[config.primary_llm],
                        prompt=integration_test_prompt
                    )
                elif category == 'security_testing':
                    chains[category] = LLMChain(
                        llm=self.models[config.primary_llm],
                        prompt=security_test_prompt
                    )
        
        return chains
    
    async def process_query(self, query: str, context: Optional[Dict] = None) -> Dict:
        """Process a query using keyword routing to select optimal LLM"""
        
        # Route query to appropriate category and LLM
        category, routing_config, confidence = self.router.route(
            query, 
            context.get('conversation_history', '') if context else ''
        )
        
        logger.info(f"Routed to category: {category} with confidence: {confidence:.2f}")
        logger.info(f"Using primary LLM: {routing_config.primary_llm.value}")
        
        # Prepare full context
        full_context = {
            'conversation_history': self.memory.buffer,
            'routing_info': {
                'category': category,
                'confidence': confidence,
                'primary_llm': routing_config.primary_llm.value
            },
            'user_context': context or {}
        }
        
        # Get response from primary LLM
        primary_response = await self._get_llm_response(
            routing_config.primary_llm,
            category,
            query,
            full_context
        )
        
        # Get responses from secondary LLMs if configured
        secondary_responses = []
        if routing_config.secondary_llms and confidence < 0.9:
            for llm_type in routing_config.secondary_llms[:2]:  # Limit to 2 secondary
                if llm_type in self.models:
                    response = await self._get_llm_response(
                        llm_type,
                        category,
                        query,
                        full_context
                    )
                    secondary_responses.append(response)
        
        # Blend responses if multiple
        if secondary_responses:
            final_response = self._blend_responses(
                primary_response,
                secondary_responses,
                routing_config
            )
        else:
            final_response = primary_response
        
        # Update memory
        self.memory.save_context(
            {"input": query},
            {"output": final_response}
        )
        
        # Add to conversation history
        self.conversation_history.append({
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'category': category,
            'llm_used': routing_config.primary_llm.value,
            'confidence': confidence,
            'response': final_response
        })
        
        return {
            'response': final_response,
            'metadata': {
                'category': category,
                'primary_llm': routing_config.primary_llm.value,
                'secondary_llms': [llm.value for llm in routing_config.secondary_llms],
                'confidence': confidence,
                'keywords_matched': [kw for kw in routing_config.keywords if kw in query.lower()]
            }
        }
    
    async def _get_llm_response(self, llm_type: LLMType, category: str, query: str, context: Dict) -> str:
        """Get response from specific LLM"""
        if llm_type not in self.models:
            logger.warning(f"LLM {llm_type.value} not available")
            return ""
        
        llm = self.models[llm_type]
        
        # Use appropriate chain if available
        if category in self.chains:
            try:
                response = self.chains[category].run(
                    query=query,
                    context=json.dumps(context),
                    language=context.get('user_context', {}).get('language', 'Python'),
                    framework=context.get('user_context', {}).get('framework', 'pytest')
                )
                return response
            except Exception as e:
                logger.error(f"Chain execution error: {e}")
        
        # Fallback to direct LLM call
        try:
            messages = [
                HumanMessage(content=f"Context: {json.dumps(context)}\n\nQuery: {query}")
            ]
            response = llm.predict_messages(messages)
            return response.content
        except Exception as e:
            logger.error(f"LLM response error: {e}")
            return f"Error getting response from {llm_type.value}: {str(e)}"
    
    def _blend_responses(self, primary: str, secondary: List[str], config: RoutingConfig) -> str:
        """Blend multiple LLM responses intelligently"""
        if not secondary:
            return primary
        
        # Simple blending strategy - can be enhanced
        blend_prompt = f"""Synthesize these expert responses into a comprehensive answer:

Primary Response ({config.primary_llm.value}):
{primary}

Secondary Responses:
{chr(10).join([f"- {resp[:500]}..." for resp in secondary])}

Create a unified response that incorporates the best insights from all responses."""
        
        # Use primary LLM for blending
        if config.primary_llm in self.models:
            try:
                messages = [HumanMessage(content=blend_prompt)]
                blended = self.models[config.primary_llm].predict_messages(messages)
                return blended.content
            except Exception as e:
                logger.error(f"Blending error: {e}")
        
        return primary
    
    def update_routing_keywords(self, category: str, keywords: List[str], append: bool = True):
        """Update routing keywords for a category"""
        self.router.update_keywords(category, keywords, append)
        logger.info(f"Updated keywords for {category}")
    
    def add_api_key(self, service: str, key: str):
        """Add or update an API key"""
        self.api_keys[service] = key
        keys_file = self.data_dir / "api_keys.json"
        with open(keys_file, 'w') as f:
            json.dump(self.api_keys, f, indent=2)
        
        # Reinitialize models
        self.models = self._initialize_models()
        self.chains = self._initialize_chains()
        logger.info(f"Updated API key for {service}")
    
    def get_routing_stats(self) -> Dict:
        """Get statistics about routing and model usage"""
        stats = {
            'total_queries': len(self.conversation_history),
            'categories': {},
            'models': {},
            'average_confidence': 0.0
        }
        
        if self.conversation_history:
            total_confidence = 0
            for entry in self.conversation_history:
                # Category stats
                cat = entry['category']
                stats['categories'][cat] = stats['categories'].get(cat, 0) + 1
                
                # Model stats
                model = entry['llm_used']
                stats['models'][model] = stats['models'].get(model, 0) + 1
                
                # Confidence
                total_confidence += entry['confidence']
            
            stats['average_confidence'] = total_confidence / len(self.conversation_history)
        
        return stats


# FastAPI Integration
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List

class QueryRequest(BaseModel):
    query: str
    context: Optional[Dict] = None
    language: Optional[str] = "Python"
    framework: Optional[str] = None

class KeywordUpdateRequest(BaseModel):
    category: str
    keywords: List[str]
    append: bool = True

class APIKeyRequest(BaseModel):
    service: str
    key: str

# Create FastAPI app
app = FastAPI(title="TestLab LangChain AI Router")

# Initialize the system
ai_system = LangChainTestingSystem()

@app.post("/api/ai/query")
async def process_query(request: QueryRequest):
    """Process a query using keyword-based LLM routing"""
    try:
        context = request.context or {}
        if request.language:
            context['language'] = request.language
        if request.framework:
            context['framework'] = request.framework
        
        result = await ai_system.process_query(request.query, context)
        return result
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/keywords")
async def update_keywords(request: KeywordUpdateRequest):
    """Update routing keywords for a category"""
    try:
        ai_system.update_routing_keywords(
            request.category,
            request.keywords,
            request.append
        )
        return {"message": f"Keywords updated for {request.category}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/keys")
async def update_api_key(request: APIKeyRequest):
    """Add or update an API key"""
    try:
        ai_system.add_api_key(request.service, request.key)
        return {"message": f"API key updated for {request.service}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/config")
async def get_configuration():
    """Get current routing configuration"""
    config_path = ai_system.config_dir / "routing_config.yaml"
    if config_path.exists():
        return FileResponse(str(config_path))
    raise HTTPException(status_code=404, detail="Configuration not found")

@app.get("/api/ai/stats")
async def get_routing_stats():
    """Get routing and usage statistics"""
    return ai_system.get_routing_stats()

@app.get("/api/ai/categories")
async def get_categories():
    """Get all available routing categories"""
    return {
        "categories": list(ai_system.router.routing_rules.keys()),
        "details": {
            cat: {
                "keywords": config.keywords,
                "primary_llm": config.primary_llm.value,
                "secondary_llms": [llm.value for llm in config.secondary_llms]
            }
            for cat, config in ai_system.router.routing_rules.items()
        }
    }

@app.get("/api/ai/models")
async def get_available_models():
    """Get list of initialized models"""
    return {
        "available": [llm_type.value for llm_type in ai_system.models.keys()],
        "total": len(ai_system.models)
    }

@app.get("/api/ai/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_initialized": len(ai_system.models),
        "categories_configured": len(ai_system.router.routing_rules),
        "config_dir": str(ai_system.config_dir),
        "data_dir": str(ai_system.data_dir)
    }

if __name__ == "__main__":
    import uvicorn
    # Run on port 3003 to not conflict with existing TestLab services
    uvicorn.run(app, host="0.0.0.0", port=3003)