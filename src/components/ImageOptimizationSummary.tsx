/**
 * Image Optimization Summary Component
 * Shows the current optimization status and features
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, Zap } from "lucide-react";

const ImageOptimizationSummary: React.FC = () => {
  const features = [
    {
      name: "Lazy Loading",
      status: "active",
      description: "Images load only when entering viewport",
      icon: <Clock className="h-4 w-4" />
    },
    {
      name: "IndexedDB Cache",
      status: "active", 
      description: "Base64 images cached locally for 7 days",
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      name: "Service Worker",
      status: "active",
      description: "Advanced caching for local assets only",
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      name: "Image Compression",
      status: "active",
      description: "Auto WebP/AVIF conversion with 85% quality",
      icon: <Zap className="h-4 w-4" />
    },
    {
      name: "Priority Loading",
      status: "active",
      description: "First 3 cards load eagerly for better LCP",
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      name: "External Images",
      status: "fixed",
      description: "Google avatars and external APIs bypass SW",
      icon: <CheckCircle className="h-4 w-4" />
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'fixed': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          Image Optimization System Status
        </CardTitle>
        <CardDescription>
          Advanced image loading, caching, and compression system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {features.map((feature) => (
            <div key={feature.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-gray-600">
                  {feature.icon}
                </div>
                <div>
                  <div className="font-medium">{feature.name}</div>
                  <div className="text-sm text-gray-600">{feature.description}</div>
                </div>
              </div>
              <Badge className={`${getStatusColor(feature.status)} text-white`}>
                {feature.status}
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Performance Benefits</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 60-80% file size reduction through compression</li>
            <li>• Smooth loading with skeleton placeholders</li>
            <li>• Multi-layer caching (Browser + IndexedDB + Service Worker)</li>
            <li>• Priority loading for above-the-fold content</li>
            <li>• Memory efficient Base64 → Blob URL conversion</li>
            <li>• No layout shifts with proper aspect ratios</li>
          </ul>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Development Mode</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Compression ratios and debug info are shown in development. 
              Check browser console for detailed logging.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageOptimizationSummary;