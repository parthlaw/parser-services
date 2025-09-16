import os
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any, Optional, List

class SupabaseClient:
    """
    A lightweight Supabase client that uses the REST API directly.
    No external dependencies required - uses only Python standard library.
    """
    
    def __init__(self, url: str, anon_key: str):
        self.base_url = url.rstrip('/')
        self.anon_key = anon_key
        self.api_url = f"{self.base_url}/rest/v1"
        
    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Make an HTTP request to the Supabase API.
        
        Args:
            method: HTTP method (GET, POST, PATCH, DELETE)
            endpoint: API endpoint (e.g., 'jobs', 'integration_jobs')
            data: Request body data for POST/PATCH
            params: Query parameters
            
        Returns:
            Dict containing the response data
            
        Raises:
            Exception: If the request fails
        """
        url = f"{self.api_url}/{endpoint}"
        
        # Add query parameters
        if params:
            query_string = urllib.parse.urlencode(params)
            url = f"{url}?{query_string}"
        
        # Prepare headers
        headers = {
            'apikey': self.anon_key,
            'Authorization': f'Bearer {self.anon_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'  # Return the inserted/updated data
        }
        
        # Prepare request
        req_data = None
        if data:
            req_data = json.dumps(data).encode('utf-8')
            
        request = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(request) as response:
                response_data = response.read().decode('utf-8')
                if response_data:
                    return json.loads(response_data)
                return {}
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else 'No error details'
            raise Exception(f"Supabase API error {e.code}: {error_body}")
        except Exception as e:
            raise Exception(f"Request failed: {str(e)}")
    
    def insert(self, table: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Insert a record into a table.
        
        Args:
            table: Table name
            data: Data to insert
            
        Returns:
            List containing the inserted record
        """
        result = self._make_request('POST', table, data)
        return result if isinstance(result, list) else [result] if result else []
    
    def update(self, table: str, data: Dict[str, Any], filters: Dict[str, str]) -> List[Dict[str, Any]]:
        """
        Update records in a table.
        
        Args:
            table: Table name
            data: Data to update
            filters: Where conditions (e.g., {'id': 'eq.uuid-here'})
            
        Returns:
            List containing the updated records
        """
        result = self._make_request('PATCH', table, data, filters)
        return result if isinstance(result, list) else [result] if result else []
    
    def select(self, table: str, filters: Optional[Dict[str, str]] = None, 
               select: str = '*', order: Optional[str] = None, 
               limit: Optional[int] = None, offset: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Select records from a table.
        
        Args:
            table: Table name
            filters: Where conditions
            select: Columns to select (default: '*')
            order: Order by clause (e.g., 'created_at.desc')
            limit: Maximum number of records
            offset: Number of records to skip
            
        Returns:
            List of matching records
        """
        params = {'select': select}
        
        if filters:
            params.update(filters)
        if order:
            params['order'] = order
        if limit:
            params['limit'] = str(limit)
        if offset:
            params['offset'] = str(offset)
            
        result = self._make_request('GET', table, params=params)
        return result if isinstance(result, list) else []

def get_supabase_client() -> SupabaseClient:
    """
    Get a Supabase client instance using environment variables.
    
    Returns:
        SupabaseClient: Configured Supabase client
        
    Raises:
        ValueError: If required environment variables are not set
    """
    supabase_url = os.getenv("SUPABASE_URL") or ""
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") or ""
    
    if not supabase_url:
        raise ValueError("SUPABASE_URL environment variable is required")
    if not supabase_anon_key:
        raise ValueError("SUPABASE_ANON_KEY environment variable is required")
    
    return SupabaseClient(supabase_url, supabase_anon_key)

# Global client instance
_supabase_client: Optional[SupabaseClient] = None

def init_supabase() -> SupabaseClient:
    """Initialize the global Supabase client."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = get_supabase_client()
    return _supabase_client 