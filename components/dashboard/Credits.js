'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Wallet, Plus, ShoppingCart } from 'lucide-react';

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [creditAmount, setCreditAmount] = useState(1);
  const [success, setSuccess] = useState('');

  // Fetch user credits
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Students')
          .select('credits')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching credits:', error);
        } else {
          setCredits(data?.credits || 0);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Handle credit purchase
  const handleBuyCredits = async () => {
    if (!user || creditAmount <= 0) return;

    setPurchasing(true);
    setSuccess('');

    try {
      // Get current credits
      const { data: currentData, error: fetchError } = await supabase
        .from('Students')
        .select('credits')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentCredits = currentData?.credits || 0;
      const newCredits = currentCredits + creditAmount;

      // Update credits in database
      const { error: updateError } = await supabase
        .from('Students')
        .update({ credits: newCredits })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setCredits(newCredits);
      setSuccess(`Successfully purchased ${creditAmount} credit${creditAmount > 1 ? 's' : ''}!`);
      
      // Reset form
      setCreditAmount(1);
    } catch (error) {
      console.error('Error purchasing credits:', error);
      alert('Error purchasing credits. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Wallet className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">My Credits</h3>
      </div>

      {/* Current Credits Display */}
      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600 mb-2">{credits}</div>
          <p className="text-gray-600">Available Credits</p>
        </div>
      </div>

      {/* Credit Information */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-600 text-center">
          <span className="font-semibold">1 Credit = 30 minutes</span> of tutoring time
        </p>
      </div>

      {/* Purchase Credits Section */}
      <div className="border-t pt-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-green-600" />
          Purchase Credits
        </h4>

        <div className="space-y-4">
          {/* Credit Amount Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Credits: <span className="font-bold text-blue-600">{creditAmount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={creditAmount}
              onChange={(e) => setCreditAmount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>50</span>
            </div>
          </div>

          {/* Price Display */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Credits:</span>
              <span className="text-lg font-semibold text-green-600">{creditAmount}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-700">Total Time:</span>
              <span className="text-sm text-gray-600">{creditAmount * 30} minutes</span>
            </div>
          </div>

          {/* Buy Button */}
          <button
            onClick={handleBuyCredits}
            disabled={purchasing || creditAmount <= 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {purchasing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Buy {creditAmount} Credit{creditAmount > 1 ? 's' : ''}
              </>
            )}
          </button>

          {/* Success Message */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
