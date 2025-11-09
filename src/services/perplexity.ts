import Perplexity from '@perplexity-ai/perplexity_ai';

// Lazy-load API key
const getClient = (): Perplexity => {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is required. Please check your backend/.env file.');
  }
  // Initialize client with API key as ClientOptions
  return new Perplexity({ apiKey });
};

export interface ListingData {
  project_name?: string;
  developer_name?: string;
  bhk_configuration?: string;
  price?: string;
  area_sqft?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  amenities?: string[];
  furnishing_status?: string;
  property_type?: string;
  contact_number?: string;
  availability_date?: string;
  source_url?: string;
  title?: string;
  snippet?: string;
}

export interface PerplexitySearchResult {
  url: string;
  title: string;
  snippet: string;
}

export const perplexityService = {
  // Search for real estate listings
  async searchListings(city: string = 'Hyderabad'): Promise<{
    results: PerplexitySearchResult[];
    listings: ListingData[];
  }> {
    try {
      const client = getClient();

      // Comprehensive search query combining all sources
      const query = (
        `Extract structured flat listing data for ${city} city from ` +
        `nobroker.in, housing.com, facebook.com/marketplace, makaan.com, ` +
        `and magicbricks.com. Include for each listing: ` +
        `project name, developer name, BHK configuration, price, area (sqft), ` +
        `location (with latitude and longitude if available), amenities, ` +
        `furnishing status, property type (new/resale/rental), contact number, ` +
        `and availability date. Focus on verified listings and new launches. ` +
        `Output should be structured as JSON data suitable for a real estate database.`
      );

      console.log('Perplexity search query:', query);

      // Create search request - using the structure from @perplexity-ai/perplexity_ai
      const searchResponse = await client.search.create({
        query: query,
        max_results: 20,
        max_tokens_per_page: 2048
      });

      console.log('Perplexity search response:', JSON.stringify(searchResponse, null, 2));

      // Extract results
      const results: PerplexitySearchResult[] = [];
      const listings: ListingData[] = [];

      // Process search results
      if (searchResponse.results && Array.isArray(searchResponse.results)) {
        for (const result of searchResponse.results) {
          // Add to results
          results.push({
            url: result.url || '',
            title: result.title || '',
            snippet: result.snippet || ''
          });

          // Try to extract structured data from snippet
          const listing = extractListingData(result);
          if (listing) {
            listings.push(listing);
          }
        }
      }

      return {
        results,
        listings
      };
    } catch (error: any) {
      console.error('Perplexity API Error:', error);
      
      // Extract detailed error message
      let errorMessage = error.message || 'Unknown error';
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      throw new Error(`Failed to search listings: ${errorMessage}`);
    }
  }
};

// Helper function to extract structured listing data from search results
function extractListingData(result: any): ListingData | null {
  try {
    const snippet = result.snippet || '';
    const title = result.title || '';
    const url = result.url || '';

    // Try to parse JSON from snippet if it contains structured data
    let listing: ListingData = {
      source_url: url,
      title: title,
      snippet: snippet.substring(0, 500)
    };

    // Extract common patterns from text
    const priceMatch = snippet.match(/₹?\s*([\d,]+)\s*(lakh|lac|cr|crore|thousand)/i);
    if (priceMatch) {
      listing.price = priceMatch[0];
    }

    const areaMatch = snippet.match(/([\d,]+)\s*(sqft|sq\.ft|sq\.\s*ft|square\s*feet)/i);
    if (areaMatch) {
      listing.area_sqft = areaMatch[1];
    }

    const bhkMatch = snippet.match(/(\d+)\s*(BHK|bhk|bedroom)/i);
    if (bhkMatch) {
      listing.bhk_configuration = bhkMatch[0];
    }

    // Try to extract location
    const locationMatch = snippet.match(/(?:location|area|situated|located)[:\s]+([A-Za-z\s,]+)/i);
    if (locationMatch) {
      listing.location = locationMatch[1].trim();
    }

    // Try to extract property type
    if (snippet.match(/new\s+(?:launch|project|construction)/i)) {
      listing.property_type = 'new';
    } else if (snippet.match(/resale/i)) {
      listing.property_type = 'resale';
    } else if (snippet.match(/rent|rental/i)) {
      listing.property_type = 'rental';
    }

    // Try to extract furnishing status
    if (snippet.match(/fully\s+furnished/i)) {
      listing.furnishing_status = 'fully_furnished';
    } else if (snippet.match(/semi\s+furnished/i)) {
      listing.furnishing_status = 'semi_furnished';
    } else if (snippet.match(/unfurnished/i)) {
      listing.furnishing_status = 'unfurnished';
    }

    // Extract amenities
    const amenities: string[] = [];
    const amenityKeywords = ['parking', 'lift', 'security', 'gym', 'swimming pool', 'garden', 'power backup'];
    for (const keyword of amenityKeywords) {
      if (snippet.toLowerCase().includes(keyword)) {
        amenities.push(keyword);
      }
    }
    if (amenities.length > 0) {
      listing.amenities = amenities;
    }

    // Try to extract contact number
    const phoneMatch = snippet.match(/(\+91|91)?[\s-]?[6-9]\d{9}/);
    if (phoneMatch) {
      listing.contact_number = phoneMatch[0];
    }

    return listing;
  } catch (error) {
    console.error('Error extracting listing data:', error);
    return null;
  }
}

