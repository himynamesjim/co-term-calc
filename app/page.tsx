'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Calendar, FileText, Mail, Minus, Plus, Download, Trash2, Calculator, Edit2, Save, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MessageSquare, Send, X, Info, LogOut, FolderOpen } from 'lucide-react';
import { PaywallModal } from '@/components/paywall-modal';
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { AuthModal } from '@/components/auth-modal';
import { LandingPage } from '@/components/landing-page';
import { supabase, getCurrentUser, signOut, isSupabaseConfigured, getSessionToken } from '@/lib/supabase';
import { generateCoTermPDF } from '@/lib/pdf-generator';
import { generateCoTermEmail, generateCoTermEmailText } from '@/lib/email-generator';

interface LicenseItem {
  id: string;
  serviceDescription: string;
  quantity: number;
  annualCost: number;
  additionalLicenses: number;
}

type BillingTerm = 'Monthly' | 'Annual' | 'Pre-Paid';

export default function CoTermCalcPage() {
  const { hasAccess, isLoading, isDesignLimitReached, isNotLoggedIn, designsCreated, designLimit } = useFeatureAccess('coterm-calc');

  // Debug logging
  useEffect(() => {
    console.log('[CoTerm] Auth State:', { isLoading, hasAccess, isNotLoggedIn, isDesignLimitReached });
  }, [isLoading, hasAccess, isNotLoggedIn, isDesignLimitReached]);

  const [currentStep, setCurrentStep] = useState(1);
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(380);
  const [showPaywall, setShowPaywall] = useState(false);

  // Sidebar collapse states
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  // Mobile panel states
  const [isMobileLeftPanelOpen, setIsMobileLeftPanelOpen] = useState(false);
  const [isMobileRightPanelOpen, setIsMobileRightPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size and adjust panel widths
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 1024);

      // Adjust right panel width based on screen size
      if (width < 1024) {
        // Mobile - hide panel
        setRightWidth(0);
      } else if (width < 1400) {
        // Small desktop - narrower panel
        setRightWidth(Math.min(320, width * 0.25));
      } else {
        // Large desktop - default width
        setRightWidth(380);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load solution from saved solutions page
  useEffect(() => {
    const loadSolution = async () => {
      const loadSolutionId = localStorage.getItem('loadSolutionId');
      if (!loadSolutionId) return;

      console.log('🔄 Loading CoTerm calculation from saved solutions:', loadSolutionId);

      try {
        // Fetch the specific solution
        const response = await fetch('/api/get-designs');
        if (response.ok) {
          const data = await response.json();
          const solution = data.designs?.find((d: any) => d.id === loadSolutionId);

          console.log('📊 Found solution:', solution);

          if (solution && solution.design_type === 'coterm-calc') {
            const designData = solution.design_data || {};
            console.log('📦 Design data:', designData);

            // Restore agreement info
            if (designData.agreementStartDate) setAgreementStartDate(designData.agreementStartDate);
            if (designData.agreementTermMonths) setAgreementTermMonths(designData.agreementTermMonths);
            if (designData.coTermStartDate) setCoTermStartDate(designData.coTermStartDate);
            if (designData.useCalculatedMonths !== undefined) setUseCalculatedMonths(designData.useCalculatedMonths);
            if (designData.manualMonthsRemaining) setManualMonthsRemaining(designData.manualMonthsRemaining);
            if (designData.addExtension !== undefined) setAddExtension(designData.addExtension);
            if (designData.extensionMonths) setExtensionMonths(designData.extensionMonths);

            // Restore licensing info
            if (designData.numberOfLineItems) setNumberOfLineItems(designData.numberOfLineItems);
            if (designData.billingTerm) setBillingTerm(designData.billingTerm);
            if (designData.licenses) {
              console.log('📝 Restoring licenses:', designData.licenses);
              setLicenses(designData.licenses);
            }

            // Set the design ID to prevent auto-save duplicates
            setCurrentDesignId(solution.id);

            // Advance to results step if available
            const hasData = solution.ai_response || designData.licenses?.length > 0;
            console.log('✅ Has data to show results?', hasData, {
              ai_response: !!solution.ai_response,
              licenses_count: designData.licenses?.length || 0
            });

            if (hasData) {
              console.log('🎯 Advancing to step 3 (results)');
              setCurrentStep(3);
            } else {
              console.log('⚠️ No data found, staying at step 0');
            }

            console.log('✅ CoTerm calculation loaded successfully');
          } else {
            console.error('❌ Solution not found or wrong type');
          }
        }
      } catch (error) {
        console.error('Error loading coterm calculation:', error);
      } finally {
        // Clear the localStorage item
        localStorage.removeItem('loadSolutionId');
      }
    };

    loadSolution();
  }, []);

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string>('');
  const [generatedEmailText, setGeneratedEmailText] = useState<string>('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<'preview' | 'source' | 'text'>('preview');
  const [showAgreementEdit, setShowAgreementEdit] = useState(false);

  // Auth state
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auto-save and saved designs
  const [savedDesigns, setSavedDesigns] = useState<any[]>([]);
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
  const [editingDesignTitle, setEditingDesignTitle] = useState('');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [selectedCalcForDetail, setSelectedCalcForDetail] = useState<any | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // Step 1: Agreement Info
  const [projectName, setProjectName] = useState('');
  const [agreementStartDate, setAgreementStartDate] = useState('2025-04-02');
  const [agreementTermMonths, setAgreementTermMonths] = useState(36);
  const [coTermStartDate, setCoTermStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [useCalculatedMonths, setUseCalculatedMonths] = useState(true);
  const [manualMonthsRemaining, setManualMonthsRemaining] = useState(12);
  const [addExtension, setAddExtension] = useState(false);
  const [extensionMonths, setExtensionMonths] = useState(12);

  // Step 2: Licensing
  const [numberOfLineItems, setNumberOfLineItems] = useState(1);
  const [billingTerm, setBillingTerm] = useState<BillingTerm>('Annual');
  const [licenses, setLicenses] = useState<LicenseItem[]>([
    { id: '1', serviceDescription: '', quantity: 1, annualCost: 0, additionalLicenses: 0 }
  ]);

  // Calculated values
  const calculateMonthsRemaining = () => {
    // If manual mode, use the manual months
    if (!useCalculatedMonths) {
      return addExtension ? manualMonthsRemaining + extensionMonths : manualMonthsRemaining;
    }

    // Otherwise calculate based on dates
    const start = new Date(agreementStartDate);
    const coTerm = new Date(coTermStartDate);
    const diffTime = coTerm.getTime() - start.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
    const baseMonthsRemaining = Math.max(0, agreementTermMonths - diffMonths);

    // Add extension months if the option is enabled
    return addExtension ? baseMonthsRemaining + extensionMonths : baseMonthsRemaining;
  };

  const monthsRemaining = calculateMonthsRemaining();

  // Format currency with commas and 2 decimal places
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Calculate months from co-term start to end of current year
  const calculateCurrentYearMonths = () => {
    const coTerm = new Date(coTermStartDate);
    const start = new Date(agreementStartDate);

    // Calculate the end date of the agreement
    const agreementEnd = new Date(start);
    agreementEnd.setMonth(agreementEnd.getMonth() + agreementTermMonths);

    // Calculate which year of the agreement we're in
    const monthsSinceStart = (coTerm.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const currentYearNumber = Math.floor(monthsSinceStart / 12);

    // Calculate the end of the current year
    const currentYearEnd = new Date(start);
    currentYearEnd.setMonth(currentYearEnd.getMonth() + ((currentYearNumber + 1) * 12));

    // If current year end is beyond agreement end, use agreement end
    const effectiveYearEnd = currentYearEnd > agreementEnd ? agreementEnd : currentYearEnd;

    // Calculate months from co-term start to end of current year
    const monthsToYearEnd = (effectiveYearEnd.getTime() - coTerm.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    // Can't be more than total months remaining or less than 0
    return Math.max(0, Math.min(monthsToYearEnd, monthsRemaining));
  };

  const currentYearMonths = calculateCurrentYearMonths();

  const updateLicense = (id: string, field: keyof LicenseItem, value: any) => {
    if (!handleInteraction()) return;
    setLicenses(licenses.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const calculateCoTermCost = (license: LicenseItem) => {
    // Convert to monthly rate based on billing term
    let monthlyRate = 0;
    if (billingTerm === 'Monthly') {
      monthlyRate = license.annualCost; // annualCost field holds monthly cost when billing is monthly
      return monthlyRate * monthsRemaining;
    } else if (billingTerm === 'Annual') {
      monthlyRate = license.annualCost / 12;
      // For Annual, calculate current year cost only (for additional licenses)
      return monthlyRate * license.additionalLicenses * currentYearMonths;
    } else { // Pre-Paid
      monthlyRate = license.annualCost / 12;
      return monthlyRate * monthsRemaining;
    }
  };

  const calculateResults = () => {
    // Calculate costs based on billing term
    let currentMonthlyCost = 0;
    let currentAnnualCost = 0;

    if (billingTerm === 'Monthly') {
      // For monthly billing, annualCost field holds the monthly cost
      currentMonthlyCost = licenses.reduce((sum, l) => sum + (l.annualCost * l.quantity), 0);
      currentAnnualCost = currentMonthlyCost * 12;
    } else {
      // For annual/pre-paid, annualCost field holds the annual cost
      currentAnnualCost = licenses.reduce((sum, l) => sum + (l.annualCost * l.quantity), 0);
      currentMonthlyCost = currentAnnualCost / 12;
    }

    // Calculate additional licenses cost
    let additionalMonthlyCost = 0;
    let additionalAnnualCost = 0;

    if (billingTerm === 'Monthly') {
      additionalMonthlyCost = licenses.reduce((sum, l) => sum + (l.annualCost * l.additionalLicenses), 0);
      additionalAnnualCost = additionalMonthlyCost * 12;
    } else {
      additionalAnnualCost = licenses.reduce((sum, l) => sum + (l.annualCost * l.additionalLicenses), 0);
      additionalMonthlyCost = additionalAnnualCost / 12;
    }

    // Calculate updated costs
    const updatedMonthlyCost = currentMonthlyCost + additionalMonthlyCost;
    const updatedAnnualCost = currentAnnualCost + additionalAnnualCost;

    // Calculate remaining total (cost for remaining months)
    let remainingTotal = updatedMonthlyCost * monthsRemaining;

    // For Annual billing, calculate current year cost only (from co-term start to end of current agreement year)
    // For Monthly/Pre-Paid, use full remaining term cost
    let coTermCost = remainingTotal;
    if (billingTerm === 'Annual') {
      // Calculate only for ADDITIONAL licenses for current year
      coTermCost = additionalMonthlyCost * currentYearMonths;

      // For remaining total: current year (additional only) + remaining years (all licenses)
      const remainingMonthsAfterCurrentYear = Math.floor(monthsRemaining - currentYearMonths);
      remainingTotal = coTermCost + (updatedMonthlyCost * remainingMonthsAfterCurrentYear);
    }

    // Total cost of ownership
    const totalCostOfOwnership = (currentMonthlyCost * 12) + remainingTotal;

    return {
      currentMonthlyCost,
      currentAnnualCost,
      updatedMonthlyCost,
      updatedAnnualCost,
      costChange: updatedAnnualCost - currentAnnualCost, // Annual cost change
      monthlyCostChange: updatedMonthlyCost - currentMonthlyCost, // Monthly cost change
      costChangePercent: currentAnnualCost > 0 ? ((updatedAnnualCost - currentAnnualCost) / currentAnnualCost * 100) : 0,
      remainingTotal,
      coTermCost, // For Annual: first year only, For Monthly/Pre-Paid: full remaining term
      totalCostOfOwnership,
      totalLicenses: licenses.reduce((sum, l) => sum + l.quantity + l.additionalLicenses, 0)
    };
  };

  const results = calculateResults();

  // Initialize auth and fetch user
  useEffect(() => {
    const initAuth = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch saved designs when user changes
  useEffect(() => {
    const fetchSavedDesigns = async () => {
      if (!user) {
        setSavedDesigns([]);
        return;
      }

      try {
        const token = await getSessionToken();
        const response = await fetch(`/api/get-designs?design_type=coterm-calc&user_id=${user.id}`, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        if (response.ok) {
          const data = await response.json();
          setSavedDesigns(data.designs || []);
        }
      } catch (error) {
        console.error('Error fetching saved designs:', error);
      }
    };

    fetchSavedDesigns();
  }, [user]);

  // Auto-save effect
  useEffect(() => {
    // Only auto-save if we're past step 1 (clicked Next at least once)
    // OR if user has modified the default agreement data
    const hasModifiedData = agreementStartDate !== '2025-04-02' || agreementTermMonths !== 36;
    const isPastStep1 = currentStep > 1;

    if (!isPastStep1 && !hasModifiedData) {
      console.log('Skipping auto-save: still on step 1 with default data');
      return;
    }

    console.log('Auto-save triggered:', { currentStep, isPastStep1, hasModifiedData });

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Debounce auto-save by 2 seconds
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        // Calculate results for saving
        const calcResults = calculateResults();
        const calcMonthsRemaining = calculateMonthsRemaining();

        if (currentDesignId) {
          // Update existing design
          const updateRes = await fetch('/api/update-design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              design_id: currentDesignId,
              design_data: {
                agreementStartDate,
                agreementTermMonths,
                coTermStartDate,
                useCalculatedMonths,
                manualMonthsRemaining,
                addExtension,
                extensionMonths,
                billingTerm,
                licenses,
                companyLogo,
                currentStep
              },
              ai_response: {
                totalCost: calcResults.updatedAnnualCost,
                licenseCount: calcResults.totalLicenses,
                monthsRemaining: calcMonthsRemaining,
                coTermCost: calcResults.coTermCost
              }
            })
          });

          if (updateRes.ok) {
            console.log('Co-Term calculation auto-saved');
          }
        } else {
          // Create new design
          const saveRes = await fetch('/api/save-design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              design_type: 'coterm-calc',
              design_data: {
                agreementStartDate,
                agreementTermMonths,
                coTermStartDate,
                useCalculatedMonths,
                manualMonthsRemaining,
                addExtension,
                extensionMonths,
                billingTerm,
                licenses,
                companyLogo,
                currentStep
              },
              ai_response: {
                totalCost: calcResults.updatedAnnualCost,
                licenseCount: calcResults.totalLicenses,
                monthsRemaining: calcMonthsRemaining,
                coTermCost: calcResults.coTermCost
              },
              title: `Co-Term Calc (In Progress)`
            })
          });

          if (saveRes.ok) {
            const saveData = await saveRes.json();
            setCurrentDesignId(saveData.design.id);
            console.log('Co-Term calculation saved:', saveData.title);
            // Refresh saved designs list
            const response = await fetch('/api/get-designs?design_type=coterm-calc');
            if (response.ok) {
              const data = await response.json();
              setSavedDesigns(data.designs || []);
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-save:', err);
      }
    }, 2000); // 2 second debounce

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [agreementStartDate, agreementTermMonths, coTermStartDate, useCalculatedMonths, manualMonthsRemaining, addExtension, extensionMonths, billingTerm, licenses, companyLogo, currentStep, currentDesignId]);

  const nextStep = async () => {
    if (!handleInteraction()) return;

    const newStep = currentStep + 1;
    if (currentStep < 4) setCurrentStep(newStep);

    // Mark as complete when reaching results page (step 3)
    if (newStep === 3 && licenses.length > 0 && currentDesignId) {
      try {
        // Calculate results for saving
        const calcResults = calculateResults();
        const calcMonthsRemaining = calculateMonthsRemaining();

        const updateRes = await fetch('/api/update-design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            design_id: currentDesignId,
            design_data: {
              agreementStartDate,
              agreementTermMonths,
              coTermStartDate,
              useCalculatedMonths,
              manualMonthsRemaining,
              addExtension,
              extensionMonths,
              billingTerm,
              licenses,
              companyLogo,
              currentStep: newStep,
              isComplete: true
            },
            ai_response: {
              totalCost: calcResults.updatedAnnualCost,
              licenseCount: calcResults.totalLicenses,
              monthsRemaining: calcMonthsRemaining,
              coTermCost: calcResults.coTermCost
            }
          })
        });

        if (updateRes.ok) {
          console.log('Co-Term calculation completed');
        }
      } catch (saveErr) {
        console.error('Failed to complete co-term calculation:', saveErr);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generateCoTermPDF({
        projectName,
        agreementStartDate,
        agreementTermMonths,
        coTermStartDate,
        monthsRemaining,
        currentYearMonths,
        billingTerm,
        licenses,
        results,
        companyLogo
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateEmailContent = () => {
    try {
      const emailData = {
        projectName,
        agreementStartDate,
        agreementTermMonths,
        coTermStartDate,
        monthsRemaining,
        currentYearMonths,
        billingTerm,
        licenses,
        results: {
          currentMonthlyCost: results.currentMonthlyCost,
          currentAnnualCost: results.currentAnnualCost,
          updatedMonthlyCost: results.updatedMonthlyCost,
          updatedAnnualCost: results.updatedAnnualCost,
          monthlyCostChange: results.monthlyCostChange,
          costChange: results.costChange,
          costChangePercent: results.costChangePercent,
          coTermCost: results.coTermCost
        }
      };

      const emailHTML = generateCoTermEmail(emailData);
      const emailText = generateCoTermEmailText(emailData);

      setGeneratedEmail(emailHTML);
      setGeneratedEmailText(emailText);
    } catch (error) {
      console.error('Error generating email:', error);
      alert('Failed to generate email. Please try again.');
    }
  };

  const copyEmailToClipboard = async () => {
    if (!generatedEmail) return;

    try {
      await navigator.clipboard.writeText(generatedEmail);
      alert('Email copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy email. Please try again.');
    }
  };

  const downloadEmailTemplate = () => {
    if (!generatedEmail) return;

    try {
      // Create proper EML format
      const subject = projectName
        ? `Co-Term Analysis Report - ${projectName}`
        : 'Co-Term Analysis Report';

      const emlContent = [
        'Subject: ' + subject,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        generatedEmail
      ].join('\r\n');

      // Create a blob from the EML content
      const blob = new Blob([emlContent], { type: 'message/rfc822' });

      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename based on project name
      const fileName = projectName
        ? `${projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-coterm-email-${new Date().toISOString().split('T')[0]}.eml`
        : `coterm-email-template-${new Date().toISOString().split('T')[0]}.eml`;

      link.download = fileName;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Email template downloaded! You can now open it with Outlook or your email client.');
    } catch (error) {
      console.error('Error downloading email template:', error);
      alert('Failed to download email template. Please try again.');
    }
  };

  const handleSaveCalculation = async () => {
    try {
      // Calculate results for saving
      const calcResults = calculateResults();
      const calcMonthsRemaining = calculateMonthsRemaining();

      if (currentDesignId) {
        // Update existing design and mark as complete
        const updateRes = await fetch('/api/update-design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            design_id: currentDesignId,
            design_data: {
              agreementStartDate,
              agreementTermMonths,
              coTermStartDate,
              useCalculatedMonths,
              manualMonthsRemaining,
              addExtension,
              extensionMonths,
              billingTerm,
              licenses,
              companyLogo,
              currentStep,
              isComplete: true
            },
            ai_response: {
              totalCost: calcResults.updatedAnnualCost,
              licenseCount: calcResults.totalLicenses,
              monthsRemaining: calcMonthsRemaining,
              coTermCost: calcResults.coTermCost
            }
          })
        });

        if (updateRes.ok) {
          alert('Calculation saved successfully!');
          // Refresh saved designs list
          const response = await fetch('/api/get-designs?design_type=coterm-calc');
          if (response.ok) {
            const data = await response.json();
            setSavedDesigns(data.designs || []);
          }
        } else {
          alert('Failed to save calculation. Please try again.');
        }
      } else {
        // Create new design
        const saveRes = await fetch('/api/save-design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            design_type: 'coterm-calc',
            design_data: {
              agreementStartDate,
              agreementTermMonths,
              coTermStartDate,
              useCalculatedMonths,
              manualMonthsRemaining,
              addExtension,
              extensionMonths,
              billingTerm,
              licenses,
              companyLogo,
              currentStep,
              isComplete: true
            },
            ai_response: {
              totalCost: calcResults.updatedAnnualCost,
              licenseCount: calcResults.totalLicenses,
              monthsRemaining: calcMonthsRemaining,
              coTermCost: calcResults.coTermCost
            },
            title: `Co-Term Calculation - ${new Date().toLocaleDateString()}`
          })
        });

        if (saveRes.ok) {
          const saveData = await saveRes.json();
          setCurrentDesignId(saveData.design.id);
          alert('Calculation saved successfully!');
          // Refresh saved designs list
          const response = await fetch('/api/get-designs?design_type=coterm-calc');
          if (response.ok) {
            const data = await response.json();
            setSavedDesigns(data.designs || []);
          }
        } else {
          alert('Failed to save calculation. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving calculation:', error);
      alert('An error occurred while saving. Please try again.');
    }
  };

  const handleStartOver = () => {
    if (confirm('Are you sure you want to start over? This will clear all current data.')) {
      // Reset to Step 1
      setCurrentStep(1);

      // Reset all state
      setAgreementStartDate('2025-04-02');
      setAgreementTermMonths(36);
      const today = new Date();
      setCoTermStartDate(today.toISOString().split('T')[0]);
      setUseCalculatedMonths(true);
      setNumberOfLineItems(1);
      setBillingTerm('Annual');
      setLicenses([{
        id: '1',
        serviceDescription: '',
        quantity: 1,
        annualCost: 0,
        additionalLicenses: 0
      }]);
      setCompanyLogo(null);
      setChatMessages([]);
      setChatInput('');
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this calculation?')) {
      return;
    }

    try {
      const response = await fetch('/api/get-designs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_id: designId })
      });

      if (response.ok) {
        // Remove from local state
        setSavedDesigns(savedDesigns.filter(d => d.id !== designId));
        // If we're deleting the current design, clear the ID
        if (currentDesignId === designId) {
          setCurrentDesignId(null);
        }
      } else {
        alert('Failed to delete calculation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting calculation:', error);
      alert('An error occurred while deleting. Please try again.');
    }
  };

  const handleLoadDesign = async (designId: string) => {
    try {
      const design = savedDesigns.find(d => d.id === designId);
      if (!design) return;

      const designData = design.design_data || {};

      // Load all the design data into state
      setCurrentDesignId(design.id);
      setAgreementStartDate(designData.agreementStartDate || '2025-04-02');
      setAgreementTermMonths(designData.agreementTermMonths || 36);
      setCoTermStartDate(designData.coTermStartDate || new Date().toISOString().split('T')[0]);
      setUseCalculatedMonths(designData.useCalculatedMonths ?? true);
      setNumberOfLineItems(designData.numberOfLineItems || 1);
      setBillingTerm(designData.billingTerm || 'Annual');
      setLicenses(designData.licenses || [{
        id: '1',
        serviceDescription: '',
        quantity: 1,
        annualCost: 0,
        additionalLicenses: 0
      }]);
      setCompanyLogo(designData.companyLogo || null);

      // Load AI chat messages if available
      if (design.ai_response?.messages) {
        setChatMessages(design.ai_response.messages);
      }

      // Set to the appropriate step
      setCurrentStep(designData.currentStep || 1);
    } catch (error) {
      console.error('Error loading calculation:', error);
      alert('An error occurred while loading the calculation. Please try again.');
    }
  };

  const handleRenameDesign = async (designId: string) => {
    if (!editingDesignTitle.trim()) {
      alert('Please enter a name for the calculation.');
      return;
    }

    try {
      const response = await fetch('/api/get-designs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_id: designId, title: editingDesignTitle.trim() })
      });

      if (response.ok) {
        // Update local state
        setSavedDesigns(savedDesigns.map(d =>
          d.id === designId ? { ...d, title: editingDesignTitle.trim() } : d
        ));
        setEditingDesignId(null);
        setEditingDesignTitle('');
      } else {
        alert('Failed to rename calculation. Please try again.');
      }
    } catch (error) {
      console.error('Error renaming calculation:', error);
      alert('An error occurred while renaming. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!handleInteraction()) return;
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoadingChat(true);

    // Add user message to chat
    const newMessages = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);

    try {
      // Prepare calculator state
      const calculatorState = {
        agreementStartDate,
        agreementTermMonths,
        coTermStartDate,
        billingTerm,
        licenses,
        monthsRemaining
      };

      const response = await fetch('/api/chat-coterm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          licenseData: calculatorState
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage = data.message || 'Sorry, I encountered an error. Please try again.';

      // Add assistant response to chat
      setChatMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);

      // Process actions from the API response
      if (data.actions && Array.isArray(data.actions)) {
        let updatedLicenses = [...licenses];

        data.actions.forEach((action: any) => {
          // Handle date actions
          if (action.type === 'set_agreement_start_date' && action.data?.date) {
            setAgreementStartDate(action.data.date);
          } else if (action.type === 'set_coterm_date' && action.data?.date) {
            setCoTermStartDate(action.data.date);
          } else if (action.type === 'set_agreement_term' && action.data?.months) {
            setAgreementTermMonths(action.data.months);
          }
          // Handle license actions
          else if (action.type === 'add_license' && action.data) {
            const newLicense: LicenseItem = {
              id: Date.now().toString() + Math.random(),
              serviceDescription: action.data.serviceDescription || '',
              quantity: action.data.quantity || 0,
              annualCost: action.data.annualCost || 0,
              additionalLicenses: action.data.additionalLicenses || 0
            };
            updatedLicenses = [...updatedLicenses, newLicense];
          } else if (action.type === 'set_additional_licenses' && action.data && action.data.serviceDescription) {
            // Find matching license by service description (fuzzy match)
            const searchTerm = action.data.serviceDescription.toLowerCase().trim();
            const matchingLicense = updatedLicenses.find(l =>
              l.serviceDescription.toLowerCase().includes(searchTerm) ||
              searchTerm.includes(l.serviceDescription.toLowerCase())
            );

            if (matchingLicense) {
              updatedLicenses = updatedLicenses.map(l =>
                l.id === matchingLicense.id
                  ? { ...l, additionalLicenses: action.data.additionalLicenses || 0 }
                  : l
              );
            }
          } else if (action.type === 'update_license' && action.data) {
            if (action.data.id) {
              updatedLicenses = updatedLicenses.map(l =>
                l.id === action.data.id
                  ? { ...l, ...action.data }
                  : l
              );
            } else if (action.data.serviceDescription) {
              const searchTerm = action.data.serviceDescription.toLowerCase().trim();
              updatedLicenses = updatedLicenses.map(l =>
                l.serviceDescription.toLowerCase().includes(searchTerm)
                  ? { ...l, ...action.data }
                  : l
              );
            }
          } else if (action.type === 'remove_license' && action.data) {
            if (action.data.id) {
              updatedLicenses = updatedLicenses.filter(l => l.id !== action.data.id);
            } else if (action.data.serviceDescription) {
              const searchTerm = action.data.serviceDescription.toLowerCase().trim();
              updatedLicenses = updatedLicenses.filter(l =>
                !l.serviceDescription.toLowerCase().includes(searchTerm)
              );
            }
          }
        });

        setLicenses(updatedLicenses);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages([...newMessages, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Save function (used by both auto-save and manual save)
  const saveCalculation = async () => {
    // Only save if project name is set and user is logged in
    if (!projectName.trim() || !user) {
      console.log('Cannot save: missing project name or user');
      return false;
    }

    const designData = {
      projectName,
      agreementStartDate,
      agreementTermMonths,
      coTermStartDate,
      useCalculatedMonths,
      manualMonthsRemaining,
      addExtension,
      extensionMonths,
      billingTerm,
      licenses,
      numberOfLineItems,
    };

    try {
      setIsSaving(true);
      const token = await getSessionToken();
      const response = await fetch('/api/save-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          title: projectName,
          designData,
          designType: 'coterm-calc',
          userId: user.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Saved successfully:', data.message);
        setHasUnsavedChanges(false);
        setLastSavedTime(new Date());

        // Refresh saved designs list
        if (user) {
          const fetchResponse = await fetch(`/api/get-designs?design_type=coterm-calc&user_id=${user.id}`, {
            headers: {
              ...(token && { 'Authorization': `Bearer ${token}` })
            }
          });
          if (fetchResponse.ok) {
            const fetchData = await fetchResponse.json();
            setSavedDesigns(fetchData.designs || []);
          }
        }
        return true;
      } else {
        const errorData = await response.json();
        console.error('Save failed:', errorData);
        return false;
      }
    } catch (error) {
      console.error('Save error:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Manual save handler
  const handleManualSave = async () => {
    const success = await saveCalculation();
    if (!success) {
      alert('Failed to save. Please make sure you are logged in and have entered a project name.');
    }
  };

  // Mark as unsaved when data changes
  useEffect(() => {
    if (projectName.trim() && user) {
      setHasUnsavedChanges(true);
    }
  }, [projectName, agreementStartDate, agreementTermMonths, coTermStartDate, useCalculatedMonths, manualMonthsRemaining, addExtension, extensionMonths, billingTerm, licenses, numberOfLineItems]);

  // Auto-save every 10 seconds when there are unsaved changes
  useEffect(() => {
    if (hasUnsavedChanges && projectName.trim() && user) {
      const timeoutId = setTimeout(() => {
        saveCalculation();
      }, 10000); // Auto-save after 10 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [hasUnsavedChanges, projectName, agreementStartDate, agreementTermMonths, coTermStartDate, useCalculatedMonths, manualMonthsRemaining, addExtension, extensionMonths, billingTerm, licenses, numberOfLineItems, user]);

  // Alias for mobile panel compatibility
  const handleSendChat = handleSendMessage;

  const handleResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setLeftWidth(Math.max(200, Math.min(500, startWidth + delta)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeRight = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setRightWidth(Math.max(300, Math.min(600, startWidth + delta)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const StepIndicator = ({ step, title, status }: { step: number; title: string; status: 'complete' | 'current' | 'upcoming' }) => (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
        status === 'complete' ? 'bg-green-600 text-slate-900 dark:text-white' :
        status === 'current' ? 'bg-blue-600 text-slate-900 dark:text-white' :
        'bg-slate-700 text-slate-400'
      }`}>
        {status === 'complete' ? <CheckCircle2 className="h-5 w-5" /> : step}
      </div>
      <div>
        <div className="text-xs text-slate-400">Step {step}</div>
        <div className={`text-sm font-medium ${status === 'upcoming' ? 'text-slate-500' : 'text-slate-200'}`}>
          {title}
        </div>
      </div>
    </div>
  );

  // For non-logged-in users, allow viewing but block interactions
  // For logged-in users without access, show paywall immediately
  const shouldBlockImmediately = !isLoading && !isNotLoggedIn && (!hasAccess || isDesignLimitReached);

  if (shouldBlockImmediately) {
    return (
      <>
        <PaywallModal
          isOpen={true}
          onClose={() => {}}
          reason={isDesignLimitReached ? `Design limit reached (${designsCreated}/${designLimit})` : 'Trial expired - upgrade to professional tier'}
        />
      </>
    );
  }

  // Handler to check access before interactions
  const handleInteraction = () => {
    console.log('[CoTerm handleInteraction] isNotLoggedIn:', isNotLoggedIn, 'showPaywall:', showPaywall);
    if (isNotLoggedIn) {
      console.log('[CoTerm handleInteraction] Showing paywall for non-logged-in user');
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  // Show landing page for non-logged-in users
  if (!user && !isLoading) {
    return (
      <>
        <LandingPage onGetStarted={() => setShowAuthModal(true)} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={async () => {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
          }}
        />
      </>
    );
  }

  return (
    <div className="dark bg-slate-950" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .nav-btn { transition: all 0.2s ease; }
        .nav-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Mobile Menu Buttons */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
          zIndex: 100,
          padding: '12px',
          background: 'rgba(10, 13, 20, 0.95)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <button
            onClick={() => {
              setIsMobileRightPanelOpen(!isMobileRightPanelOpen);
              setIsMobileLeftPanelOpen(false);
            }}
            style={{
              padding: '10px 16px',
              background: isMobileRightPanelOpen ? 'linear-gradient(to right, rgb(59,130,246), rgb(37,99,235))' : 'rgba(255,255,255,0.05)',
              color: 'white',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            <MessageSquare size={18} />
            AI Chat
          </button>
        </div>
      )}

      <div className="bg-[#0c0f18] text-slate-200" style={{ flex: 1, display: "flex", fontFamily: "'Outfit', sans-serif", overflow: "hidden", position: 'relative' }}>

        {/* Left Sidebar - Navigation */}
        {!isMobile && !isLeftSidebarCollapsed && (
          <aside className="bg-[#0a0d14]" style={{
            width: `${leftWidth}px`,
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="text-slate-200" style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
                CoTerm Calculator
              </h2>
              <button
                onClick={() => setIsLeftSidebarCollapsed(true)}
                style={{
                  padding: "4px",
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: "4px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            {/* Login Section */}
            <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {!isSupabaseConfigured ? (
                <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.4" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#e2e8f0", marginBottom: "8px" }}>
                    Setup Required
                  </div>
                  Configure Supabase to enable login and save calculations. See SUPABASE_SETUP.md for instructions.
                </div>
              ) : user ? (
                <div>
                  <button
                    onClick={() => {
                      setSelectedCalcForDetail(null);
                      setCurrentStep(1);
                      setProjectName('');
                      setAgreementStartDate('');
                      setAgreementTermMonths(36);
                      setCoTermStartDate('');
                      setLicenses([{
                        id: '1',
                        serviceDescription: '',
                        quantity: 0,
                        annualCost: 0,
                        additionalLicenses: 0
                      }]);
                      setBillingTerm('Annual');
                      setNumberOfLineItems(1);
                      setUseCalculatedMonths(true);
                      setManualMonthsRemaining(12);
                      setAddExtension(false);
                      setExtensionMonths(12);
                      setCompanyLogo(null);
                      setCurrentDesignId(null);
                      setHasUnsavedChanges(false);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm mb-3 flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Start New Calc
                  </button>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
                    {user.email}
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                      setUser(null);
                      setSavedDesigns([]);
                    }}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  Login / Sign Up
                </button>
              )}
            </div>

            {/* Saved Calculations */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  Saved Calculations
                </h3>
                {savedDesigns.length > 0 && (
                  <button
                    onClick={() => window.location.href = '/calcs'}
                    style={{
                      padding: "6px 12px",
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#2563eb"}
                    onMouseOut={(e) => e.currentTarget.style.background = "#3b82f6"}
                  >
                    View All
                  </button>
                )}
              </div>
              {savedDesigns.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "32px 16px" }}>
                  No saved calculations yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {savedDesigns.map((design) => {
                    const isHovering = hoveredCardId === design.id;

                    return (
                      <div
                        key={design.id}
                        style={{
                          padding: "12px",
                          background: isHovering ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          position: "relative"
                        }}
                        onMouseEnter={() => setHoveredCardId(design.id)}
                        onMouseLeave={() => setHoveredCardId(null)}
                        onClick={() => {
                          setSelectedCalcForDetail(design);
                        }}
                      >
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0", marginBottom: "4px", paddingRight: isHovering ? "60px" : "0", transition: "padding 0.2s" }}>
                          {design.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {new Date(design.updated_at).toLocaleDateString()}
                        </div>

                        {/* Hover Actions */}
                        {isHovering && (
                          <div style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            display: "flex",
                            gap: "4px",
                            background: "rgba(15, 23, 42, 0.95)",
                            padding: "4px",
                            borderRadius: "6px",
                            border: "1px solid rgba(255,255,255,0.1)"
                          }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const data = design.design_data;
                                if (data) {
                                  setProjectName(data.projectName || '');
                                  setAgreementStartDate(data.agreementStartDate || '');
                                  setAgreementTermMonths(data.agreementTermMonths || 36);
                                  setCoTermStartDate(data.coTermStartDate || '');
                                  setLicenses(data.licenses || []);
                                  setBillingTerm(data.billingTerm || 'Annual');
                                  setNumberOfLineItems(data.numberOfLineItems || 1);
                                  setUseCalculatedMonths(data.useCalculatedMonths ?? true);
                                  setManualMonthsRemaining(data.manualMonthsRemaining || 12);
                                  setAddExtension(data.addExtension || false);
                                  setExtensionMonths(data.extensionMonths || 12);
                                }
                                setSelectedCalcForDetail(null);
                                setCurrentStep(1);
                              }}
                              style={{
                                padding: "4px 6px",
                                background: "rgba(59, 130, 246, 0.1)",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                borderRadius: "4px",
                                color: "#60a5fa",
                                cursor: "pointer",
                                fontSize: "11px",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                              }}
                              title="Edit calculation"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Are you sure you want to delete this calculation?')) return;

                                try {
                                  const token = await getSessionToken();
                                  const response = await fetch('/api/delete-design', {
                                    method: 'DELETE',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token && { 'Authorization': `Bearer ${token}` })
                                    },
                                    body: JSON.stringify({ design_id: design.id })
                                  });

                                  if (response.ok) {
                                    setSavedDesigns(savedDesigns.filter(d => d.id !== design.id));
                                    if (selectedCalcForDetail?.id === design.id) {
                                      setSelectedCalcForDetail(null);
                                    }
                                  } else {
                                    alert('Failed to delete calculation');
                                  }
                                } catch (error) {
                                  console.error('Delete error:', error);
                                  alert('Failed to delete calculation');
                                }
                              }}
                              style={{
                                padding: "4px 6px",
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "4px",
                                color: "#f87171",
                                cursor: "pointer",
                                fontSize: "11px",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                              }}
                              title="Delete calculation"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Left Sidebar Collapsed */}
        {!isMobile && isLeftSidebarCollapsed && (
          <div
            style={{
              width: "48px",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              background: "#0a0d14",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 0",
              gap: "12px",
            }}
          >
            {/* Expand Button */}
            <button
              onClick={() => setIsLeftSidebarCollapsed(false)}
              style={{
                width: "32px",
                height: "32px",
                background: "rgba(255,255,255,0.05)",
                border: "none",
                borderRadius: "6px",
                color: "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "#94a3b8";
              }}
              title="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>

            <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.06)" }} />

            {/* New Calculation Button */}
            {user && (
              <button
                onClick={() => {
                  setSelectedCalcForDetail(null);
                  setCurrentStep(1);
                  setProjectName('');
                  setAgreementStartDate('');
                  setAgreementTermMonths(36);
                  setCoTermStartDate('');
                  setLicenses([{
                    id: '1',
                    serviceDescription: '',
                    quantity: 0,
                    annualCost: 0,
                    additionalLicenses: 0
                  }]);
                  setBillingTerm('Annual');
                  setNumberOfLineItems(1);
                  setUseCalculatedMonths(true);
                  setManualMonthsRemaining(12);
                  setAddExtension(false);
                  setExtensionMonths(12);
                  setCompanyLogo(null);
                  setCurrentDesignId(null);
                  setHasUnsavedChanges(false);
                }}
                style={{
                  width: "32px",
                  height: "32px",
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#2563eb";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#3b82f6";
                }}
                title="New Calculation"
              >
                <Calculator size={16} />
              </button>
            )}

            {/* View All Calcs Button */}
            {user && savedDesigns.length > 0 && (
              <button
                onClick={() => window.location.href = '/calcs'}
                style={{
                  width: "32px",
                  height: "32px",
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#3b82f6";
                  e.currentTarget.style.color = "white";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "#94a3b8";
                }}
                title="View All Calculations"
              >
                <FolderOpen size={16} />
              </button>
            )}

            {/* Spacer to push sign out to bottom */}
            <div style={{ flex: 1 }} />

            {/* Sign Out Button */}
            {user && (
              <button
                onClick={async () => {
                  await signOut();
                  setUser(null);
                  setSavedDesigns([]);
                }}
                style={{
                  width: "32px",
                  height: "32px",
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                  e.currentTarget.style.color = "#ef4444";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "#94a3b8";
                }}
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}

        {/* Main Content - Wizard */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px", paddingBottom: isMobile ? "120px" : "40px", position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          {/* Ambient background */}
          <div style={{ position: "absolute", top: "-200px", right: "-200px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

          {selectedCalcForDetail ? (
            /* Calculation Detail View */
            <div style={{ width: "100%", maxWidth: "min(1200px, 100%)", position: "relative", zIndex: 1 }}>
              <div style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(20px)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)", padding: "32px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "16px" }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#e2e8f0", margin: 0 }}>{selectedCalcForDetail.title}</h2>
                  <button
                    onClick={() => setSelectedCalcForDetail(null)}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      padding: "8px 16px",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    Close
                  </button>
                </div>

                {/* Calc Details */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Agreement Start</div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#e2e8f0" }}>
                      {selectedCalcForDetail.design_data?.agreementStartDate ? new Date(selectedCalcForDetail.design_data.agreementStartDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Term (Months)</div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#e2e8f0" }}>
                      {selectedCalcForDetail.design_data?.agreementTermMonths || 0}
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Licenses</div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#e2e8f0" }}>
                      {selectedCalcForDetail.design_data?.licenses?.length || 0}
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Last Updated</div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#e2e8f0" }}>
                      {new Date(selectedCalcForDetail.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      const data = selectedCalcForDetail.design_data;
                      if (data) {
                        setProjectName(data.projectName || '');
                        setAgreementStartDate(data.agreementStartDate || '');
                        setAgreementTermMonths(data.agreementTermMonths || 36);
                        setCoTermStartDate(data.coTermStartDate || '');
                        setLicenses(data.licenses || []);
                        setBillingTerm(data.billingTerm || 'Annual');
                        setNumberOfLineItems(data.numberOfLineItems || 1);
                        setUseCalculatedMonths(data.useCalculatedMonths ?? true);
                        setManualMonthsRemaining(data.manualMonthsRemaining || 12);
                        setAddExtension(data.addExtension || false);
                        setExtensionMonths(data.extensionMonths || 12);
                      }
                      setSelectedCalcForDetail(null);
                      setCurrentStep(1);
                    }}
                    style={{
                      background: "#3b82f6",
                      border: "none",
                      borderRadius: "8px",
                      padding: "12px 24px",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Calculation
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const data = selectedCalcForDetail.design_data;
                        const licenses = data.licenses || [];
                        const billingTerm = data.billingTerm || 'Annual';

                        // Calculate current costs based on billing term
                        let currentAnnualCost = 0;
                        let currentMonthlyCost = 0;
                        let updatedAnnualCost = 0;
                        let updatedMonthlyCost = 0;

                        if (billingTerm === 'Monthly') {
                          currentMonthlyCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * l.quantity), 0);
                          currentAnnualCost = currentMonthlyCost * 12;

                          updatedMonthlyCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
                          updatedAnnualCost = updatedMonthlyCost * 12;
                        } else {
                          currentAnnualCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * l.quantity), 0);
                          currentMonthlyCost = currentAnnualCost / 12;

                          updatedAnnualCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
                          updatedMonthlyCost = updatedAnnualCost / 12;
                        }

                        const costChange = updatedAnnualCost - currentAnnualCost;
                        const monthlyCostChange = updatedMonthlyCost - currentMonthlyCost;
                        const costChangePercent = currentAnnualCost > 0
                          ? ((updatedAnnualCost - currentAnnualCost) / currentAnnualCost) * 100
                          : 0;

                        const agreementStart = new Date(data.agreementStartDate);
                        const coTermStart = new Date(data.coTermStartDate);
                        const agreementEnd = new Date(agreementStart);
                        agreementEnd.setMonth(agreementEnd.getMonth() + data.agreementTermMonths);

                        const monthsRemaining = (agreementEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

                        const yearEnd = new Date(coTermStart.getFullYear(), 11, 31);
                        const currentYearMonths = billingTerm === 'Annual'
                          ? (yearEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                          : 0;

                        const coTermCost = licenses.reduce((sum: number, l: any) => {
                          const monthlyRate = billingTerm === 'Monthly' ? l.annualCost : l.annualCost / 12;
                          return sum + (monthlyRate * l.additionalLicenses * currentYearMonths);
                        }, 0);

                        await generateCoTermPDF({
                          projectName: selectedCalcForDetail.title,
                          agreementStartDate: data.agreementStartDate || '',
                          agreementTermMonths: data.agreementTermMonths || 0,
                          coTermStartDate: data.coTermStartDate || '',
                          monthsRemaining: monthsRemaining,
                          currentYearMonths: currentYearMonths,
                          billingTerm: billingTerm,
                          licenses: licenses,
                          results: {
                            currentMonthlyCost,
                            currentAnnualCost,
                            updatedMonthlyCost,
                            updatedAnnualCost,
                            monthlyCostChange,
                            costChange,
                            costChangePercent,
                            coTermCost
                          },
                          companyLogo: data.companyLogo || null
                        });
                      } catch (error) {
                        console.error('Error generating PDF:', error);
                        alert('Failed to generate PDF. Please try again.');
                      }
                    }}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      padding: "12px 24px",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const data = selectedCalcForDetail.design_data;
                        const licenses = data.licenses || [];
                        const billingTerm = data.billingTerm || 'Annual';

                        // Calculate costs based on billing term
                        let currentAnnualCost = 0;
                        let currentMonthlyCost = 0;
                        let updatedAnnualCost = 0;
                        let updatedMonthlyCost = 0;

                        if (billingTerm === 'Monthly') {
                          currentMonthlyCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * l.quantity), 0);
                          currentAnnualCost = currentMonthlyCost * 12;

                          updatedMonthlyCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
                          updatedAnnualCost = updatedMonthlyCost * 12;
                        } else {
                          currentAnnualCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * l.quantity), 0);
                          currentMonthlyCost = currentAnnualCost / 12;

                          updatedAnnualCost = licenses.reduce((sum: number, l: any) =>
                            sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
                          updatedMonthlyCost = updatedAnnualCost / 12;
                        }

                        const costChange = updatedAnnualCost - currentAnnualCost;
                        const monthlyCostChange = updatedMonthlyCost - currentMonthlyCost;
                        const costChangePercent = currentAnnualCost > 0
                          ? ((updatedAnnualCost - currentAnnualCost) / currentAnnualCost) * 100
                          : 0;

                        const agreementStart = new Date(data.agreementStartDate);
                        const coTermStart = new Date(data.coTermStartDate);
                        const agreementEnd = new Date(agreementStart);
                        agreementEnd.setMonth(agreementEnd.getMonth() + data.agreementTermMonths);

                        const monthsRemaining = (agreementEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

                        const yearEnd = new Date(coTermStart.getFullYear(), 11, 31);
                        const currentYearMonths = billingTerm === 'Annual'
                          ? (yearEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                          : 0;

                        const coTermCost = licenses.reduce((sum: number, l: any) => {
                          const monthlyRate = billingTerm === 'Monthly' ? l.annualCost : l.annualCost / 12;
                          return sum + (monthlyRate * l.additionalLicenses * currentYearMonths);
                        }, 0);

                        const emailHTML = generateCoTermEmail({
                          projectName: selectedCalcForDetail.title,
                          agreementStartDate: data.agreementStartDate || '',
                          agreementTermMonths: data.agreementTermMonths || 0,
                          coTermStartDate: data.coTermStartDate || '',
                          monthsRemaining: monthsRemaining,
                          currentYearMonths: currentYearMonths,
                          billingTerm: billingTerm,
                          licenses: licenses,
                          results: {
                            currentMonthlyCost,
                            currentAnnualCost,
                            updatedMonthlyCost,
                            updatedAnnualCost,
                            monthlyCostChange,
                            costChange,
                            costChangePercent,
                            coTermCost
                          }
                        });

                        // Copy to clipboard directly
                        try {
                          await navigator.clipboard.writeText(emailHTML);
                          alert('Email HTML copied to clipboard! You can now paste it into your email client.');
                        } catch (clipError) {
                          console.error('Error copying to clipboard:', clipError);
                          alert('Email generated but failed to copy. Please try the Generate Email button in the results section.');
                        }
                      } catch (error) {
                        console.error('Error generating email:', error);
                        alert('Failed to generate email. Please try again.');
                      }
                    }}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      padding: "12px 24px",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Mail className="w-4 h-4" />
                    Email Template
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to delete this calculation?')) return;
                      try {
                        const token = await getSessionToken();
                        const response = await fetch('/api/delete-design', {
                          method: 'DELETE',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(token && { 'Authorization': `Bearer ${token}` })
                          },
                          body: JSON.stringify({ design_id: selectedCalcForDetail.id })
                        });
                        if (response.ok) {
                          setSavedDesigns(savedDesigns.filter(d => d.id !== selectedCalcForDetail.id));
                          setSelectedCalcForDetail(null);
                        }
                      } catch (error) {
                        console.error('Delete error:', error);
                      }
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "8px",
                      padding: "12px 24px",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginLeft: "auto"
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>

                {/* License Details */}
                {selectedCalcForDetail.design_data?.licenses && selectedCalcForDetail.design_data.licenses.length > 0 && (
                  <div style={{ marginTop: "24px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#e2e8f0", marginBottom: "12px" }}>License Line Items</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {selectedCalcForDetail.design_data.licenses.map((license: any, idx: number) => (
                        <div key={idx} style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "500", color: "#e2e8f0" }}>{license.serviceDescription || 'Unnamed Service'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Quantity</div>
                            <div style={{ fontSize: "13px", color: "#e2e8f0" }}>{license.quantity || 0}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Annual Cost</div>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>${(license.annualCost || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", maxWidth: "min(1200px, 100%)", position: "relative", zIndex: 1 }}>
            {/* Header with progress */}
            <div style={{ textAlign: "center", marginBottom: "32px", animation: "slideUp 0.8s ease" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 12px", borderRadius: "20px", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", marginBottom: "16px", fontSize: "12px", color: "#a855f7" }}>
                🧮 Co-Term Calculator
              </div>
              <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: "700", lineHeight: 1.2, letterSpacing: "-0.03em", marginBottom: "12px" }}>
                Calculate Co-Terming Costs
              </h1>
              <p style={{ fontSize: "14px", color: "#64748b", maxWidth: "520px", margin: "0 auto", lineHeight: 1.5 }}>
                Step {currentStep} of 3
              </p>
            </div>

            {/* Step Indicators */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "32px" }}>
              {[
                { num: 1, title: "Agreement" },
                { num: 2, title: "Licensing" },
                { num: 3, title: "Results" }
              ].map(({ num, title }) => (
                <div key={num} style={{ textAlign: "center" }}>
                  <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    margin: "0 auto 6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: "600",
                    background: currentStep >= num ? "linear-gradient(135deg, #a855f7, #9333ea)" : "rgba(255,255,255,0.05)",
                    color: currentStep >= num ? "#fff" : "#64748b",
                    border: currentStep === num ? "2px solid #a855f7" : "none"
                  }}>
                    {num}
                  </div>
                  <div style={{ fontSize: "11px", color: currentStep >= num ? "#a855f7" : "#64748b" }}>
                    {title}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ animation: "slideUp 0.4s ease" }}>
        {/* Step 1: Agreement Information */}
        {currentStep === 1 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-6">Agreement Information</h2>

            {/* Project Name */}
            <div className="mb-6">
              <div className="mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Co-Term Project Name:
                </label>
              </div>
              <input
                type="text"
                value={projectName}
                onChange={(e) => {
                  if (!handleInteraction()) return;
                  setProjectName(e.target.value);
                }}
                placeholder="Enter project name (e.g., Q1 2025 Renewal)"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Agreement Start Date:
                </label>
                <input
                  type="date"
                  value={agreementStartDate}
                  onChange={(e) => {
                    if (!handleInteraction()) return;
                    setAgreementStartDate(e.target.value);
                  }}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Agreement Term (Months):
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={agreementTermMonths}
                    onChange={(e) => {
                      if (!handleInteraction()) return;
                      setAgreementTermMonths(parseInt(e.target.value) || 0);
                    }}
                    className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => {
                      if (!handleInteraction()) return;
                      setAgreementTermMonths(Math.max(1, agreementTermMonths - 1));
                    }}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white flex-shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (!handleInteraction()) return;
                      setAgreementTermMonths(agreementTermMonths + 1);
                    }}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Co-Termed Start Date:
              </label>
              <p className="text-xs dark:text-slate-400 text-slate-600 mb-2">Select Co-Termed Start Date:</p>
              <input
                type="date"
                value={coTermStartDate}
                onChange={(e) => {
                  if (!handleInteraction()) return;
                  setCoTermStartDate(e.target.value);
                }}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ colorScheme: 'dark' }}
              />
              <p className="text-xs dark:text-slate-400 text-slate-600 mt-2">
                Selected Co-Termed Start Date: {coTermStartDate}
              </p>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 dark:text-slate-300 text-slate-700 mb-3">
                <input
                  type="checkbox"
                  checked={useCalculatedMonths}
                  onChange={(e) => {
                    if (!handleInteraction()) return;
                    setUseCalculatedMonths(e.target.checked);
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Use calculated months remaining</span>
              </label>

              {useCalculatedMonths ? (
                <div className="p-4 dark:bg-blue-900/30 bg-blue-100 border dark:border-blue-700 border-blue-300 rounded-lg">
                  <p className="text-lg font-semibold dark:text-blue-300 text-blue-700">
                    Calculated Months Remaining: {monthsRemaining.toFixed(2)}
                  </p>
                </div>
              ) : (
                <div style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "rgba(168,85,247,0.1)",
                  border: "1px solid rgba(168,85,247,0.2)",
                  animation: "slideUp 0.3s ease"
                }}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Manual Co-Term Months:
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={() => {
                        if (!handleInteraction()) return;
                        setManualMonthsRemaining(Math.max(1, manualMonthsRemaining - 1));
                      }}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#e2e8f0",
                        fontSize: "18px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    >
                      <Minus size={16} style={{ margin: "0 auto" }} />
                    </button>
                    <input
                      type="number"
                      value={manualMonthsRemaining}
                      onChange={(e) => {
                        if (!handleInteraction()) return;
                        setManualMonthsRemaining(Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      min="1"
                      style={{
                        width: "120px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(0,0,0,0.3)",
                        color: "#e2e8f0",
                        fontSize: "14px",
                        textAlign: "center"
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!handleInteraction()) return;
                        setManualMonthsRemaining(manualMonthsRemaining + 1);
                      }}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#e2e8f0",
                        fontSize: "18px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    >
                      <Plus size={16} style={{ margin: "0 auto" }} />
                    </button>
                  </div>
                  <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
                    Manually set to {manualMonthsRemaining} month{manualMonthsRemaining !== 1 ? 's' : ''} remaining
                  </p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 dark:text-slate-300 text-slate-700 mb-4">
                <input
                  type="checkbox"
                  checked={addExtension}
                  onChange={(e) => {
                    if (!handleInteraction()) return;
                    setAddExtension(e.target.checked);
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Add Agreement Extension?</span>
              </label>

              {addExtension && (
                <div style={{
                  marginLeft: "24px",
                  padding: "16px",
                  borderRadius: "8px",
                  background: "rgba(168,85,247,0.1)",
                  border: "1px solid rgba(168,85,247,0.2)",
                  animation: "slideUp 0.3s ease"
                }}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Extension Length (Months):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={() => {
                        if (!handleInteraction()) return;
                        setExtensionMonths(Math.max(1, extensionMonths - 1));
                      }}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#e2e8f0",
                        fontSize: "18px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    >
                      <Minus size={16} style={{ margin: "0 auto" }} />
                    </button>
                    <input
                      type="number"
                      value={extensionMonths}
                      onChange={(e) => {
                        if (!handleInteraction()) return;
                        setExtensionMonths(Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      min="1"
                      style={{
                        width: "100px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(0,0,0,0.3)",
                        color: "#e2e8f0",
                        fontSize: "14px",
                        textAlign: "center"
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!handleInteraction()) return;
                        setExtensionMonths(extensionMonths + 1);
                      }}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#e2e8f0",
                        fontSize: "18px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    >
                      <Plus size={16} style={{ margin: "0 auto" }} />
                    </button>
                  </div>
                  <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
                    Add {extensionMonths} month{extensionMonths !== 1 ? 's' : ''} to your co-term date
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Licensing */}
        {currentStep === 2 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-6">Service Information</h2>

            {/* Agreement Summary */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="text-blue-300 font-semibold mb-3">Agreement Information Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-slate-400">Agreement Start Date:</div>
                  <div className="text-slate-900 dark:text-white font-medium">{agreementStartDate}</div>
                </div>
                <div>
                  <div className="text-slate-400">Agreement Term:</div>
                  <div className="text-slate-900 dark:text-white font-medium">{agreementTermMonths} months</div>
                </div>
                <div>
                  <div className="text-slate-400">Co-Term Start Date:</div>
                  <div className="text-slate-900 dark:text-white font-medium">{coTermStartDate}</div>
                </div>
                <div>
                  <div className="text-slate-400">Months Remaining:</div>
                  <div className="text-slate-900 dark:text-white font-medium">{monthsRemaining.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Manual Entry / Upload Toggle */}
            <div className="flex gap-4 mb-6">
              <button className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg font-medium">
                Manual Entry
              </button>
              <button className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium">
                Upload Quote
              </button>
            </div>

            {/* Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                <h4 className="flex items-center gap-2 text-slate-300 font-semibold mb-3">
                  <FileText className="h-5 w-5" />
                  Important Instructions:
                </h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>• Enter the number of line items based on the licenses you need to co-term.</li>
                  <li>• <strong>Billing Term</strong> must be selected to calculate costs properly.</li>
                  <li>• <strong>Unit Quantity:</strong> The number of licenses currently in use.</li>
                  <li>• <strong>Additional Licenses:</strong> New licenses being added (leave as 0 if no new licenses).</li>
                  <li className="text-yellow-400 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>Make sure all fields are correctly filled before calculating costs.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                <h4 className="text-slate-300 font-semibold mb-3">For Monthly Agreements:</h4>
                <p className="text-sm text-slate-400 mb-4">**Enter the Monthly license cost in the "License Cost ($)" field.</p>

                <h4 className="text-slate-300 font-semibold mb-3">For Annual Agreements:</h4>
                <p className="text-sm text-slate-400 mb-4">**Enter the Annual license cost in the "License Cost ($)" field.</p>

                <h4 className="text-slate-300 font-semibold mb-3">For Pre-Paid Agreements:</h4>
                <p className="text-sm text-slate-400">**Enter the FULL Pre-Paid cost for each license. (Vision calculates the remaining term for the cost of the license in the BOM. You will need to find the full pre-paid cost for each license and add that to the calculator below)</p>
              </div>
            </div>

            {/* Line Items Configuration */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Number of Line Items:
              </label>
              <div className="flex gap-2 items-center max-w-xs">
                <input
                  type="number"
                  value={numberOfLineItems}
                  onChange={(e) => {
                    if (!handleInteraction()) return;
                    const num = parseInt(e.target.value) || 1;
                    setNumberOfLineItems(num);
                    // Adjust licenses array
                    if (num > licenses.length) {
                      const newLicenses = [...licenses];
                      for (let i = licenses.length; i < num; i++) {
                        newLicenses.push({
                          id: Date.now().toString() + i,
                          serviceDescription: '',
                          quantity: 1,
                          annualCost: 0,
                          additionalLicenses: 0
                        });
                      }
                      setLicenses(newLicenses);
                    } else {
                      setLicenses(licenses.slice(0, num));
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (!handleInteraction()) return;
                    const num = Math.max(1, numberOfLineItems - 1);
                    setNumberOfLineItems(num);
                    setLicenses(licenses.slice(0, num));
                  }}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (!handleInteraction()) return;
                    const num = numberOfLineItems + 1;
                    setNumberOfLineItems(num);
                    setLicenses([...licenses, {
                      id: Date.now().toString(),
                      serviceDescription: '',
                      quantity: 1,
                      annualCost: 0,
                      additionalLicenses: 0
                    }]);
                  }}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Billing Term
              </label>
              <select
                value={billingTerm}
                onChange={(e) => {
                  if (!handleInteraction()) return;
                  setBillingTerm(e.target.value as BillingTerm);
                }}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="Annual">Annual</option>
                <option value="Monthly">Monthly</option>
                <option value="Pre-Paid">Pre-Paid</option>
              </select>
            </div>

            {/* License Items */}
            {licenses.map((license, index) => (
              <div key={license.id} className="mb-6 bg-slate-900 rounded-lg p-6 border border-slate-700">
                <h4 className="text-slate-900 dark:text-white font-semibold mb-4">Item {index + 1}</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Service Description</label>
                    <input
                      type="text"
                      value={license.serviceDescription}
                      onChange={(e) => updateLicense(license.id, 'serviceDescription', e.target.value)}
                      placeholder="Enter service name"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Quantity</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={license.quantity}
                        onChange={(e) => updateLicense(license.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => updateLicense(license.id, 'quantity', Math.max(0, license.quantity - 1))}
                        className="px-2 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-900 dark:text-white"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => updateLicense(license.id, 'quantity', license.quantity + 1)}
                        className="px-2 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-900 dark:text-white"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {billingTerm === 'Monthly' ? 'Monthly' : billingTerm === 'Annual' ? 'Annual' : 'Pre-Paid'} License Cost ($)
                    </label>
                    <input
                      type="number"
                      value={license.annualCost || ''}
                      onChange={(e) => updateLicense(license.id, 'annualCost', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder={billingTerm === 'Monthly' ? 'e.g., 100' : 'e.g., 1200'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Add. Licenses</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={license.additionalLicenses}
                        onChange={(e) => updateLicense(license.id, 'additionalLicenses', parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => updateLicense(license.id, 'additionalLicenses', Math.max(0, license.additionalLicenses - 1))}
                        className="px-2 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-900 dark:text-white"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => updateLicense(license.id, 'additionalLicenses', license.additionalLicenses + 1)}
                        className="px-2 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-900 dark:text-white"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Results */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Edit Agreement Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowAgreementEdit(!showAgreementEdit)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Agreement Information</h3>
                  <span className="text-sm text-slate-400">
                    {agreementStartDate} | {agreementTermMonths} months | {monthsRemaining.toFixed(2)} months remaining
                  </span>
                </div>
                {showAgreementEdit ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </button>

              {showAgreementEdit && (
                <div className="p-6 border-t border-slate-700 bg-slate-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Agreement Start Date:
                      </label>
                      <input
                        type="date"
                        value={agreementStartDate}
                        onChange={(e) => setAgreementStartDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Agreement Term (Months):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={agreementTermMonths}
                          onChange={(e) => setAgreementTermMonths(parseInt(e.target.value) || 0)}
                          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => setAgreementTermMonths(Math.max(1, agreementTermMonths - 1))}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white flex-shrink-0"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setAgreementTermMonths(agreementTermMonths + 1)}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white flex-shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Co-Termed Start Date:
                      </label>
                      <input
                        type="date"
                        value={coTermStartDate}
                        onChange={(e) => setCoTermStartDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-400 mt-1">Selected Co-Termed Start Date: {coTermStartDate}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Billing Term:
                      </label>
                      <select
                        value={billingTerm}
                        onChange={(e) => setBillingTerm(e.target.value as BillingTerm)}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Monthly">Monthly</option>
                        <option value="Annual">Annual</option>
                        <option value="Pre-Paid">Pre-Paid</option>
                      </select>
                    </div>
                  </div>

                  {useCalculatedMonths && (
                    <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-300 mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">Calculated Months Remaining: {monthsRemaining.toFixed(2)} months</span>
                      </div>
                      <p className="text-xs text-blue-400">
                        From {coTermStartDate} to {agreementStartDate} + {agreementTermMonths} months
                      </p>
                    </div>
                  )}

                  {/* Add Extension Checkbox */}
                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="addExtension"
                        checked={addExtension}
                        onChange={(e) => setAddExtension(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="addExtension" className="text-sm font-medium text-slate-300 cursor-pointer">
                        Add Agreement Extension?
                      </label>
                    </div>

                    {addExtension && (
                      <div className="ml-7">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Extension Term (Months):
                        </label>
                        <div className="flex gap-2 max-w-xs">
                          <input
                            type="number"
                            value={extensionMonths}
                            onChange={(e) => setExtensionMonths(parseInt(e.target.value) || 0)}
                            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => setExtensionMonths(Math.max(1, extensionMonths - 1))}
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setExtensionMonths(extensionMonths + 1)}
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          New agreement end: {new Date(new Date(agreementStartDate).getTime() + (agreementTermMonths + extensionMonths) * 30.44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Co-Terming Results ({billingTerm})</h2>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-700 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <span className="text-green-300 text-sm font-medium">Calculations completed successfully!</span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700 rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-purple-300 text-sm">Current {billingTerm} Cost</div>
                    <div className="relative">
                      <button
                        onMouseEnter={() => setActiveTooltip('current')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {activeTooltip === 'current' && (
                        <div className="absolute right-0 top-6 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl z-50 text-xs text-slate-200">
                          Your current {billingTerm.toLowerCase()} cost for existing licenses before adding any new licenses.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    ${billingTerm === 'Monthly' ? formatCurrency(results.currentMonthlyCost) : formatCurrency(results.currentAnnualCost)}
                  </div>
                  <div className="text-purple-400 text-xs mt-1">
                    {licenses.reduce((sum, l) => sum + l.quantity, 0)} licenses
                    {billingTerm === 'Monthly' && <span className="ml-2">(${formatCurrency(results.currentAnnualCost)}/yr)</span>}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-700 rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-green-300 text-sm">Updated {billingTerm} Cost</div>
                    <div className="relative">
                      <button
                        onMouseEnter={() => setActiveTooltip('updated')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {activeTooltip === 'updated' && (
                        <div className="absolute right-0 top-6 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl z-50 text-xs text-slate-200">
                          Your new {billingTerm.toLowerCase()} cost including all existing licenses plus the additional licenses you're adding.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    ${billingTerm === 'Monthly' ? formatCurrency(results.updatedMonthlyCost) : formatCurrency(results.updatedAnnualCost)}
                  </div>
                  <div className="text-green-400 text-xs mt-1">
                    {results.totalLicenses} total licenses
                    {billingTerm === 'Monthly' && <span className="ml-2">(${formatCurrency(results.updatedAnnualCost)}/yr)</span>}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700 rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-blue-300 text-sm">
                      {billingTerm === 'Monthly' ? 'Total Cost of Remaining Term' : billingTerm === 'Pre-Paid' ? 'Total Co-Term Cost' : 'Current Year Co-Term Cost'}
                    </div>
                    <div className="relative">
                      <button
                        onMouseEnter={() => setActiveTooltip('coterm')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {activeTooltip === 'coterm' && (
                        <div className="absolute right-0 top-6 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl z-50 text-xs text-slate-200">
                          {billingTerm === 'Monthly'
                            ? 'The total cost for all licenses (existing + new) for the remaining months until your agreement expires.'
                            : billingTerm === 'Pre-Paid'
                              ? 'The one-time co-term cost to add the new licenses for the remaining months of your agreement.'
                              : 'The pro-rated cost to add new licenses from now until the end of the current contract year. This ensures all licenses renew together.'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">${formatCurrency(results.coTermCost)}</div>
                  <div className="text-blue-400 text-xs mt-1">
                    For {billingTerm === 'Annual' ? currentYearMonths.toFixed(2) : monthsRemaining.toFixed(2)} months
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/20 border border-orange-700 rounded-lg p-4 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-orange-300 text-sm">Cost Change</div>
                    <div className="relative">
                      <button
                        onMouseEnter={() => setActiveTooltip('change')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {activeTooltip === 'change' && (
                        <div className="absolute right-0 top-6 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl z-50 text-xs text-slate-200">
                          The percentage and dollar increase in your {billingTerm.toLowerCase()} spending after adding the new licenses.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">+{results.costChangePercent.toFixed(1)}%</div>
                  <div className="text-orange-400 text-xs mt-1">
                    {billingTerm === 'Monthly'
                      ? `+$${formatCurrency(results.monthlyCostChange)}/mo`
                      : billingTerm === 'Annual'
                        ? `+$${formatCurrency(results.costChange)}/yr`
                        : `+$${formatCurrency(results.costChange)} total`}
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-4 mb-6 flex items-start gap-3">
                <span className="text-orange-400 text-xl">ℹ️</span>
                <p className="text-orange-200 text-sm">
                  The new {billingTerm.toLowerCase()} cost represents a <strong>{results.costChangePercent.toFixed(1)}% increase</strong> from the current total cost of ownership. Additional licenses will increase your {billingTerm.toLowerCase()} spend.
                </p>
              </div>

              {/* Detailed Line Items */}
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    Detailed Line Items
                  </h3>
                  <button
                    onClick={() => {
                      const newLicense: LicenseItem = {
                        id: Date.now().toString(),
                        serviceDescription: '',
                        quantity: 0,
                        annualCost: 0,
                        additionalLicenses: 0
                      };
                      setLicenses([...licenses, newLicense]);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-slate-900 dark:text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Line Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 py-3 px-2">Service</th>
                        <th className="text-left text-slate-400 py-3 px-2">Qty</th>
                        <th className="text-left text-slate-400 py-3 px-2">{billingTerm} Fee</th>
                        <th className="text-left text-slate-400 py-3 px-2">Add. Licenses</th>
                        <th className="text-left text-slate-400 py-3 px-2">Current {billingTerm} Cost</th>
                        <th className="text-left text-slate-400 py-3 px-2">
                          {billingTerm === 'Monthly'
                            ? 'Additional Monthly Cost'
                            : billingTerm === 'Annual'
                              ? 'Current Year Co-Term Cost'
                              : 'Co-Term Cost'}
                        </th>
                        <th className="text-left text-slate-400 py-3 px-2">Updated {billingTerm} Cost</th>
                        <th className="text-left text-slate-400 py-3 px-2">Remaining Term Cost</th>
                        <th className="text-left text-slate-400 py-3 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenses.map((license) => {
                        const coTermCost = calculateCoTermCost(license);

                        // Calculate current and updated costs based on billing term
                        let currentCost, updatedCost, additionalMonthlyCost;
                        if (billingTerm === 'Monthly') {
                          currentCost = license.annualCost * license.quantity; // annualCost holds monthly cost for Monthly billing
                          updatedCost = currentCost + (license.annualCost * license.additionalLicenses);
                          additionalMonthlyCost = license.annualCost * license.additionalLicenses; // Just the additional monthly cost
                        } else {
                          currentCost = license.annualCost * license.quantity; // annualCost holds annual cost for Annual/Pre-Paid
                          updatedCost = currentCost + (license.annualCost * license.additionalLicenses);
                          additionalMonthlyCost = 0; // Not used for annual/pre-paid
                        }

                        // Calculate remaining total (always use monthly rate * months)
                        let monthlyRate = billingTerm === 'Monthly' ? license.annualCost : license.annualCost / 12;
                        let remainingTotal;

                        if (billingTerm === 'Annual') {
                          // For Annual: current year (additional only) + remaining years (all licenses)
                          const currentYearCost = monthlyRate * license.additionalLicenses * currentYearMonths;
                          const remainingMonthsAfterCurrentYear = Math.floor(monthsRemaining - currentYearMonths);
                          const remainingYearsCost = monthlyRate * (license.quantity + license.additionalLicenses) * remainingMonthsAfterCurrentYear;
                          remainingTotal = currentYearCost + remainingYearsCost;
                        } else {
                          // For Monthly/Pre-Paid: standard calculation
                          remainingTotal = (monthlyRate * (license.quantity + license.additionalLicenses)) * monthsRemaining;
                        }

                        return (
                          <tr key={license.id} className="border-b border-slate-800">
                            <td className="py-3 px-2">
                              {editingServiceId === license.id ? (
                                <input
                                  type="text"
                                  value={license.serviceDescription}
                                  onChange={(e) => {
                                    if (!handleInteraction()) return;
                                    setLicenses(licenses.map(l =>
                                      l.id === license.id
                                        ? { ...l, serviceDescription: e.target.value }
                                        : l
                                    ));
                                  }}
                                  onBlur={() => setEditingServiceId(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingServiceId(null);
                                    }
                                  }}
                                  autoFocus
                                  placeholder="Service name"
                                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-900 dark:text-white text-sm w-full focus:outline-none focus:border-blue-500"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (!handleInteraction()) return;
                                    setEditingServiceId(license.id);
                                  }}
                                  className="text-slate-900 dark:text-white cursor-pointer hover:text-blue-400 transition-colors px-2 py-1 min-h-[28px] flex items-start gap-2 group"
                                  title="Click to edit"
                                >
                                  <span className="flex-1 break-words">
                                    {license.serviceDescription || <span className="text-slate-500 italic">Click to add service name</span>}
                                  </span>
                                  <Edit2 className="h-3 w-3 text-slate-500 group-hover:text-blue-400 flex-shrink-0 mt-0.5" />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={license.quantity || ''}
                                onChange={(e) => {
                                  if (!handleInteraction()) return;
                                  setLicenses(licenses.map(l =>
                                    l.id === license.id
                                      ? { ...l, quantity: e.target.value === '' ? 0 : parseInt(e.target.value) }
                                      : l
                                  ));
                                }}
                                min="0"
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-900 dark:text-white text-sm w-20 focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={license.annualCost || ''}
                                onChange={(e) => {
                                  if (!handleInteraction()) return;
                                  setLicenses(licenses.map(l =>
                                    l.id === license.id
                                      ? { ...l, annualCost: e.target.value === '' ? 0 : parseFloat(e.target.value) }
                                      : l
                                  ));
                                }}
                                min="0"
                                step="0.01"
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-900 dark:text-white text-sm w-24 focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (!handleInteraction()) return;
                                    setLicenses(licenses.map(l =>
                                      l.id === license.id
                                        ? { ...l, additionalLicenses: Math.max(0, l.additionalLicenses - 1) }
                                        : l
                                    ));
                                  }}
                                  disabled={license.additionalLicenses === 0}
                                  className={`px-2 py-1 rounded text-slate-900 dark:text-white text-xs transition-colors ${
                                    license.additionalLicenses === 0
                                      ? 'bg-slate-800 cursor-not-allowed opacity-50'
                                      : 'bg-slate-700 hover:bg-slate-600'
                                  }`}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-blue-400 font-medium">+{license.additionalLicenses}</span>
                                <button
                                  onClick={() => {
                                    if (!handleInteraction()) return;
                                    setLicenses(licenses.map(l =>
                                      l.id === license.id
                                        ? { ...l, additionalLicenses: l.additionalLicenses + 1 }
                                        : l
                                    ));
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-slate-900 dark:text-white text-xs transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-slate-900 dark:text-white">${formatCurrency(currentCost)}</td>
                            <td className="py-3 px-2 text-blue-400">
                              {billingTerm === 'Monthly'
                                ? `+$${formatCurrency(additionalMonthlyCost)}`
                                : `$${formatCurrency(coTermCost)}`}
                            </td>
                            <td className="py-3 px-2 text-slate-900 dark:text-white">${formatCurrency(updatedCost)}</td>
                            <td className="py-3 px-2 text-slate-900 dark:text-white font-semibold">${formatCurrency(remainingTotal)}</td>
                            <td className="py-3 px-2">
                              <button
                                onClick={() => {
                                  if (!handleInteraction()) return;
                                  setLicenses(licenses.filter(l => l.id !== license.id));
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-slate-900 dark:text-white text-xs transition-colors"
                                title="Delete line item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-200 dark:bg-slate-800 font-bold">
                        <td className="py-3 px-2 text-slate-900 dark:text-white">TOTAL</td>
                        <td className="py-3 px-2 text-slate-900 dark:text-white">{licenses.reduce((sum, l) => sum + l.quantity, 0)}</td>
                        <td className="py-3 px-2 text-slate-900 dark:text-white">${formatCurrency(licenses.reduce((sum, l) => sum + l.annualCost, 0))}</td>
                        <td className="py-3 px-2 text-slate-900 dark:text-white">{licenses.reduce((sum, l) => sum + l.additionalLicenses, 0)}</td>
                        <td className="py-3 px-2 text-slate-900 dark:text-white">
                          ${billingTerm === 'Monthly'
                            ? formatCurrency(results.currentMonthlyCost)
                            : formatCurrency(results.currentAnnualCost)}
                        </td>
                        <td className="py-3 px-2 text-blue-400">
                          {billingTerm === 'Monthly'
                            ? `+$${formatCurrency(results.monthlyCostChange)}`
                            : `$${formatCurrency(licenses.reduce((sum, l) => sum + calculateCoTermCost(l), 0))}`}
                        </td>
                        <td className="py-3 px-2 text-slate-900 dark:text-white">
                          ${billingTerm === 'Monthly'
                            ? formatCurrency(results.updatedMonthlyCost)
                            : formatCurrency(results.updatedAnnualCost)}
                        </td>
                        <td className="py-3 px-2 text-slate-900 dark:text-white">
                          ${formatCurrency(licenses.reduce((sum, license) => {
                            let monthlyRate = billingTerm === 'Monthly' ? license.annualCost : license.annualCost / 12;
                            let remainingTotal;

                            if (billingTerm === 'Annual') {
                              // For Annual: current year (additional only) + remaining years (all licenses)
                              const currentYearCost = monthlyRate * license.additionalLicenses * currentYearMonths;
                              const remainingMonthsAfterCurrentYear = Math.floor(monthsRemaining - currentYearMonths);
                              const remainingYearsCost = monthlyRate * (license.quantity + license.additionalLicenses) * remainingMonthsAfterCurrentYear;
                              remainingTotal = currentYearCost + remainingYearsCost;
                            } else {
                              // For Monthly/Pre-Paid: standard calculation
                              remainingTotal = (monthlyRate * (license.quantity + license.additionalLicenses)) * monthsRemaining;
                            }

                            return sum + remainingTotal;
                          }, 0))}
                        </td>
                        <td className="py-3 px-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* License Summary & Cost Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                  <span className="text-purple-400">👥</span>
                  License Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">Current Licenses</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{licenses.reduce((sum, l) => sum + l.quantity, 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-blue-400">Additional Licenses</span>
                    <span className="text-2xl font-bold text-blue-400">+{licenses.reduce((sum, l) => sum + l.additionalLicenses, 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-green-900/20 border border-green-700 rounded-lg px-4">
                    <span className="text-green-300 font-medium">Total Licenses</span>
                    <span className="text-3xl font-bold text-green-400">{results.totalLicenses}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                  <span className="text-green-400">💲</span>
                  Cost Breakdown
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">Current {billingTerm}</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      ${billingTerm === 'Monthly' ? formatCurrency(results.currentMonthlyCost) : formatCurrency(results.currentAnnualCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">New {billingTerm}</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      ${billingTerm === 'Monthly' ? formatCurrency(results.updatedMonthlyCost) : formatCurrency(results.updatedAnnualCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-orange-900/20 border border-orange-700 rounded-lg px-4">
                    <span className="text-orange-300">Difference</span>
                    <span className="text-xl font-bold text-orange-400">
                      +${billingTerm === 'Monthly' ? formatCurrency(results.monthlyCostChange) : formatCurrency(results.costChange)}
                    </span>
                  </div>
                  {billingTerm === 'Annual' && (
                    <div className="flex justify-between items-center py-3 bg-blue-900/20 border border-blue-700 rounded-lg px-4">
                      <div>
                        <div className="text-blue-300 font-medium">Current Year Co-Term Cost</div>
                        <div className="text-blue-400 text-xs">For {currentYearMonths.toFixed(2)} months (until year end)</div>
                      </div>
                      <span className="text-2xl font-bold text-blue-400">${formatCurrency(results.coTermCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-3 bg-purple-900/20 border border-purple-700 rounded-lg px-4">
                    <div>
                      <div className="text-purple-300 font-medium">Remaining Term Total</div>
                      <div className="text-purple-400 text-xs">{monthsRemaining.toFixed(2)} months remaining</div>
                    </div>
                    <span className="text-2xl font-bold text-purple-400">
                      ${formatCurrency(licenses.reduce((sum, license) => {
                        let monthlyRate = billingTerm === 'Monthly' ? license.annualCost : license.annualCost / 12;
                        let remainingTotal;

                        if (billingTerm === 'Annual') {
                          // For Annual: current year (additional only) + remaining years (all licenses)
                          const currentYearCost = monthlyRate * license.additionalLicenses * currentYearMonths;
                          const remainingMonthsAfterCurrentYear = Math.floor(monthsRemaining - currentYearMonths);
                          const remainingYearsCost = monthlyRate * (license.quantity + license.additionalLicenses) * remainingMonthsAfterCurrentYear;
                          remainingTotal = currentYearCost + remainingYearsCost;
                        } else {
                          // For Monthly/Pre-Paid: standard calculation
                          remainingTotal = (monthlyRate * (license.quantity + license.additionalLicenses)) * monthsRemaining;
                        }

                        return sum + remainingTotal;
                      }, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-blue-900/30 border border-blue-700 rounded-lg px-4">
                    <div>
                      <div className="text-blue-300 font-medium">Total Cost of Ownership (TCO)</div>
                      <div className="text-blue-400 text-xs">{agreementTermMonths} month contract</div>
                    </div>
                    <span className="text-2xl font-bold text-blue-400">
                      ${(() => {
                        const tableRemainingTotal = licenses.reduce((sum, license) => {
                          let monthlyRate = billingTerm === 'Monthly' ? license.annualCost : license.annualCost / 12;
                          let remainingTotal;

                          if (billingTerm === 'Annual') {
                            const currentYearCost = monthlyRate * license.additionalLicenses * currentYearMonths;
                            const remainingMonthsAfterCurrentYear = Math.floor(monthsRemaining - currentYearMonths);
                            const remainingYearsCost = monthlyRate * (license.quantity + license.additionalLicenses) * remainingMonthsAfterCurrentYear;
                            remainingTotal = currentYearCost + remainingYearsCost;
                          } else {
                            remainingTotal = (monthlyRate * (license.quantity + license.additionalLicenses)) * monthsRemaining;
                          }

                          return sum + remainingTotal;
                        }, 0);

                        const currentAnnualTotal = billingTerm === 'Monthly'
                          ? results.currentMonthlyCost * 12
                          : results.currentAnnualCost;

                        return formatCurrency(currentAnnualTotal + tableRemainingTotal);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Comparison Chart */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl p-8 border border-slate-300 dark:border-slate-700 shadow-2xl">
              <h3 className="text-slate-900 dark:text-white font-bold text-xl mb-8">Cost Comparison</h3>

              <div className="relative flex">
                {/* Y-Axis Scale */}
                {(() => {
                  // Calculate the maximum value for scaling
                  const maxValue = Math.max(
                    billingTerm === 'Monthly' ? results.currentMonthlyCost : results.currentAnnualCost,
                    billingTerm === 'Monthly' ? results.updatedMonthlyCost : results.updatedAnnualCost,
                    results.remainingTotal,
                    results.totalCostOfOwnership
                  );

                  // Dynamically determine appropriate scale based on value range
                  let scale = 1;
                  let suffix = '';
                  let decimals = 0;

                  if (maxValue >= 1000000) {
                    scale = 1000000;
                    suffix = 'M';
                    decimals = 1;
                  } else if (maxValue >= 10000) {
                    scale = 1000;
                    suffix = 'k';
                    decimals = 0;
                  } else if (maxValue >= 1000) {
                    scale = 100;
                    suffix = '';
                    decimals = 0;
                  } else {
                    scale = 10;
                    suffix = '';
                    decimals = 0;
                  }

                  const roundedMax = Math.ceil(maxValue / scale) * scale;
                  const scaleSteps = 5;
                  const stepValue = roundedMax / (scaleSteps - 1);

                  return (
                    <div className="flex flex-col justify-between mr-4" style={{ height: '280px', paddingBottom: '0px' }}>
                      {Array.from({ length: scaleSteps }).map((_, i) => {
                        const value = roundedMax - (i * stepValue);
                        const displayValue = suffix ? (value / (scale * (suffix === 'M' ? 1 : 1))).toFixed(decimals) : value.toFixed(decimals);
                        return (
                          <div key={i} className="text-slate-400 text-xs font-mono text-right pr-2" style={{ height: '0px' }}>
                            ${displayValue}{suffix}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="flex-1 relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height: '280px', left: '0' }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="border-t border-slate-700/50" />
                    ))}
                  </div>

                  {/* Bars */}
                  <div className="flex items-end justify-center gap-6 px-4 relative" style={{ height: '380px', paddingBottom: '80px' }}>
                    {(() => {
                      // Calculate the maximum value for scaling
                      const maxValue = Math.max(
                        billingTerm === 'Monthly' ? results.currentMonthlyCost : results.currentAnnualCost,
                        billingTerm === 'Monthly' ? results.updatedMonthlyCost : results.updatedAnnualCost,
                        results.remainingTotal,
                        results.totalCostOfOwnership
                      );

                      // Helper function to format currency values dynamically
                      const formatCurrency = (value: number, compact: boolean = false) => {
                        if (value >= 1000000) {
                          return compact ? `$${(value / 1000000).toFixed(1)}M` : `$${(value / 1000000).toFixed(2)}M`;
                        } else if (value >= 10000) {
                          return compact ? `$${(value / 1000).toFixed(0)}k` : `$${(value / 1000).toFixed(1)}k`;
                        } else if (value >= 1000) {
                          return compact ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
                        } else {
                          return `$${value.toFixed(0)}`;
                        }
                      };

                    const bars = [
                      {
                        value: billingTerm === 'Monthly' ? results.currentMonthlyCost : results.currentAnnualCost,
                        label: `Current ${billingTerm} Cost`,
                        color: 'from-blue-600 via-blue-500 to-blue-400',
                        shadowColor: 'shadow-blue-500/50',
                        borderColor: 'border-blue-400/30'
                      },
                      {
                        value: billingTerm === 'Monthly' ? results.updatedMonthlyCost : results.updatedAnnualCost,
                        label: `Updated ${billingTerm} Cost`,
                        color: 'from-purple-600 via-purple-500 to-purple-400',
                        shadowColor: 'shadow-purple-500/50',
                        borderColor: 'border-purple-400/30'
                      },
                      {
                        value: results.remainingTotal,
                        label: 'Remaining Term Cost',
                        color: 'from-orange-600 via-orange-500 to-orange-400',
                        shadowColor: 'shadow-orange-500/50',
                        borderColor: 'border-orange-400/30'
                      },
                      {
                        value: results.totalCostOfOwnership,
                        label: `Total Cost of Ownership (${agreementTermMonths} months)`,
                        color: 'from-emerald-600 via-emerald-500 to-emerald-400',
                        shadowColor: 'shadow-emerald-500/50',
                        borderColor: 'border-emerald-400/30'
                      }
                    ];

                    return bars.map((bar, index) => {
                      const heightPercent = Math.max(15, (bar.value / maxValue) * 100);

                      return (
                        <div key={index} className="flex flex-col items-center group relative" style={{ width: '130px' }}>
                          {/* Bar container with fixed height */}
                          <div className="w-full flex flex-col justify-end items-center relative" style={{ height: '280px' }}>
                            {/* Bar */}
                            <div
                              className={`w-full bg-gradient-to-t ${bar.color} rounded-t-xl transition-all duration-700 ease-out ${bar.shadowColor} shadow-lg border-2 ${bar.borderColor} hover:scale-105 hover:shadow-2xl cursor-pointer relative overflow-hidden`}
                              style={{ height: `${heightPercent}%` }}
                            >
                              {/* Shine effect */}
                              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                              {/* Value label on bar */}
                              <div className="absolute top-2 left-0 right-0 text-center">
                                <div className="text-slate-900 dark:text-white font-bold text-sm drop-shadow-lg">
                                  {formatCurrency(bar.value, true)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom labels - Fixed position below bars */}
                          <div className="absolute text-center" style={{ top: '290px', width: '130px' }}>
                            <div className="text-slate-900 dark:text-white font-bold text-base mb-1">
                              {formatCurrency(bar.value, false)}
                            </div>
                            <div className="text-slate-400 text-xs leading-tight px-1" style={{ minHeight: '32px' }}>
                              {bar.label}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Export and Email Section */}
            <div className="space-y-6">
              {/* Logo Upload Section */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <label className="block text-sm text-slate-400 mb-2">Company Logo (Optional)</label>
                <div className="flex items-center gap-3">
                  {companyLogo ? (
                    <div className="relative">
                      <img src={companyLogo} alt="Company Logo" className="h-16 w-auto border border-slate-600 rounded" />
                      <button
                        onClick={() => setCompanyLogo(null)}
                        className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-slate-900 dark:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      Upload Logo
                    </label>
                  )}
                </div>
              </div>

              {/* PDF and Email Buttons - Same Line */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="h-5 w-5" />
                  {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF Report'}
                </button>

                <button
                  onClick={generateEmailContent}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  Generate Email Template
                </button>
              </div>

              {/* Email Preview Section */}
              {generatedEmail && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                      <Mail className="h-5 w-5 text-green-400" />
                      Email Template
                    </h3>

                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
                      <button
                        onClick={() => setEmailViewMode('preview')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          emailViewMode === 'preview'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => setEmailViewMode('text')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          emailViewMode === 'text'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Text
                      </button>
                      <button
                        onClick={() => setEmailViewMode('source')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                          emailViewMode === 'source'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        HTML
                      </button>
                    </div>
                  </div>

                  {/* Preview, Text, or Source View */}
                  {emailViewMode === 'preview' ? (
                    <div className="w-full h-96 bg-white border border-slate-300 rounded-lg overflow-auto mb-3">
                      <div dangerouslySetInnerHTML={{ __html: generatedEmail }} />
                    </div>
                  ) : emailViewMode === 'text' ? (
                    <textarea
                      value={generatedEmailText}
                      onChange={(e) => setGeneratedEmailText(e.target.value)}
                      className="w-full h-96 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm font-mono resize-none focus:outline-none focus:border-green-500 mb-3"
                      placeholder="Generated plain text email will appear here..."
                    />
                  ) : (
                    <textarea
                      value={generatedEmail}
                      onChange={(e) => setGeneratedEmail(e.target.value)}
                      className="w-full h-96 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm font-mono resize-none focus:outline-none focus:border-green-500 mb-3"
                      placeholder="Generated email HTML will appear here..."
                    />
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={downloadEmailTemplate}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Download className="h-5 w-5" />
                      Download as .EML
                    </button>
                    <button
                      onClick={copyEmailToClipboard}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
                    >
                      <FileText className="h-5 w-5" />
                      Copy HTML
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              currentStep === 1
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white'
            }`}
          >
            ← Previous
          </button>

          <div className="dark:text-slate-400 text-slate-600 text-sm">
            Step {currentStep} of 3
          </div>

          {currentStep === 3 ? (
            <button
              onClick={handleStartOver}
              className="flex items-center gap-2 px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
              Start Over
            </button>
          ) : (
            <button
              onClick={nextStep}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                currentStep === 2
                  ? 'bg-green-600 hover:bg-green-700 text-slate-900 dark:text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white'
              }`}
            >
              {currentStep === 2 ? 'Calculate' : 'Next'} →
            </button>
          )}
        </div>
            </div>
          </div>
          )}
        </main>

        {/* Floating Save Button */}
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            padding: '12px 24px',
            borderRadius: '50px',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Save Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {lastSavedTime && !hasUnsavedChanges && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
                }} />
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                  Saved {new Date(lastSavedTime).toLocaleTimeString()}
                </span>
              </div>
            )}
            {hasUnsavedChanges && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }} />
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                  Unsaved changes
                </span>
              </div>
            )}
            {!lastSavedTime && !hasUnsavedChanges && user && projectName.trim() && (
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                Ready to save
              </span>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleManualSave}
            disabled={isSaving || !projectName.trim() || !user}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: isSaving || !projectName.trim() || !user
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(255, 255, 255, 0.95)',
              color: isSaving || !projectName.trim() || !user
                ? 'rgba(255, 255, 255, 0.5)'
                : '#1e40af',
              border: 'none',
              borderRadius: '50px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isSaving || !projectName.trim() || !user ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              if (!isSaving && projectName.trim() && user) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving && projectName.trim() && user) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <Save style={{ width: '18px', height: '18px' }} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Resize Handle - Right */}
        <div
          onMouseDown={handleResizeRight}
          style={{
            width: "4px",
            cursor: "col-resize",
            background: "transparent",
            position: "relative",
          }}
        />

        {/* Right Panel - AI Assistant */}
        {!isMobile && !isRightSidebarCollapsed && (
          <aside className="bg-[#0a0d14]" style={{
            width: `${rightWidth}px`,
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="text-slate-200" style={{ fontSize: "14px", fontWeight: "600", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>💬</span>
                Ask AI Assistant
              </h3>
              <button
                onClick={() => setIsRightSidebarCollapsed(true)}
                style={{
                  padding: "4px",
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  borderRadius: "4px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
            {chatMessages.length === 0 ? (
              <p className="dark:text-slate-400 text-slate-600" style={{ fontSize: "13px", marginBottom: "16px", lineHeight: 1.5 }}>
                Ask questions about co-terming, licensing calculations, or request changes to your calculator. For example: "Add a new license called License 1 with monthly cost of $100 and add 2 additional licenses"
              </p>
            ) : (
              <div style={{ flex: 1, marginBottom: "16px", overflowY: "auto" }}>
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={msg.role === 'user' ? 'dark:bg-purple-500/10 bg-purple-50 dark:border-purple-500/30 border-purple-200' : 'dark:bg-blue-500/10 bg-blue-50 dark:border-blue-500/30 border-blue-200'}
                    style={{
                      marginBottom: "12px",
                      padding: "12px",
                      borderRadius: "8px",
                      borderWidth: "1px",
                      borderStyle: "solid"
                    }}
                  >
                    <div className={msg.role === 'user' ? 'dark:text-slate-400 text-slate-600' : 'dark:text-blue-400 text-blue-600'} style={{ fontSize: "11px", marginBottom: "4px", fontWeight: "600" }}>
                      {msg.role === 'user' ? 'You' : 'AI Assistant'}
                    </div>
                    <div className="dark:text-slate-200 text-slate-900" style={{ fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {msg.content.replace(/\{[\s\S]*"actions"[\s\S]*\}/, '').trim() || msg.content}
                    </div>
                  </div>
                ))}
                {isLoadingChat && (
                  <div className="dark:text-slate-400 text-slate-600" style={{ padding: "12px", textAlign: "center", fontSize: "13px" }}>
                    Thinking...
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: "auto" }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="e.g., Add a license called License 1 with monthly cost $100"
                className="dark:bg-black/30 bg-slate-100 dark:border-white/10 border-slate-300 dark:text-slate-200 text-slate-900 dark:placeholder-slate-500 placeholder-slate-400"
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "12px",
                  borderRadius: "8px",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  marginBottom: "12px",
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isLoadingChat}
                className={!chatInput.trim() || isLoadingChat ? 'dark:bg-white/10 bg-slate-200 dark:text-slate-500 text-slate-400' : ''}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: chatInput.trim() && !isLoadingChat ? "linear-gradient(135deg, #a855f7, #9333ea)" : undefined,
                  color: chatInput.trim() && !isLoadingChat ? "#fff" : undefined,
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: chatInput.trim() && !isLoadingChat ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  fontFamily: "inherit"
                }}
              >
                {isLoadingChat ? 'Sending...' : 'Send Question'}
              </button>
            </div>
          </div>
        </aside>
        )}

        {/* Right Sidebar Collapsed Button */}
        {!isMobile && isRightSidebarCollapsed && (
          <button
            onClick={() => setIsRightSidebarCollapsed(false)}
            style={{
              width: "40px",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              background: "#0a0d14",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 0",
            }}
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Mobile Left Panel Overlay - Saved Designs */}
        {isMobile && isMobileLeftPanelOpen && (
          <>
            <div
              onClick={() => setIsMobileLeftPanelOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 200,
                backdropFilter: 'blur(4px)',
              }}
            />
            <aside style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '85%',
              maxWidth: '350px',
              background: '#0a0d14',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
              animation: 'slideInLeft 0.3s ease-out',
            }}>
              <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🧮</span>
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', margin: 0 }}>
                    Saved Calculations
                  </h2>
                </div>
                <button
                  onClick={() => setIsMobileLeftPanelOpen(false)}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {savedDesigns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#475569' }}>
                    <p style={{ fontSize: '14px' }}>No saved calculations yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {savedDesigns.map((design) => (
                      <div
                        key={design.id}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '12px',
                          padding: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => {
                          handleLoadDesign(design.id);
                          setIsMobileLeftPanelOpen(false);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>
                              {design.title}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {new Date(design.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDesign(design.id);
                            }}
                            style={{
                              padding: '6px',
                              background: 'transparent',
                              color: '#ef4444',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              display: 'flex',
                              transition: 'background 0.2s',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </>
        )}

        {/* Mobile Right Panel Overlay - AI Chat */}
        {isMobile && isMobileRightPanelOpen && (
          <>
            <div
              onClick={() => setIsMobileRightPanelOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 200,
                backdropFilter: 'blur(4px)',
              }}
            />
            <aside style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '85%',
              maxWidth: '350px',
              background: '#0a0d14',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
              animation: 'slideInRight 0.3s ease-out',
            }}>
              <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={20} style={{ color: '#3b82f6' }} />
                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', margin: 0 }}>
                    AI Assistant
                  </h2>
                </div>
                <button
                  onClick={() => setIsMobileRightPanelOpen(false)}
                  style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#475569' }}>
                    <MessageSquare size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ fontSize: '14px', marginBottom: '8px' }}>No messages yet</p>
                    <p style={{ fontSize: '12px' }}>Ask questions about co-term calculations</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          background: msg.role === 'user' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                          border: msg.role === 'user' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.06)',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: '#e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>
                          {msg.role === 'user' ? 'You' : 'AI Assistant'}
                        </div>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                )}
                {isLoadingChat && (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    Thinking...
                  </div>
                )}
              </div>
              <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Ask a question..."
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      color: '#e2e8f0',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || isLoadingChat}
                    style={{
                      padding: '12px 18px',
                      background: chatInput.trim() && !isLoadingChat ? 'linear-gradient(to right, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                      color: 'white',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: chatInput.trim() && !isLoadingChat ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>


      {/* Paywall Modal for non-logged-in users */}
      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          reason="Please sign in to use the Co-Term Calculator"
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          // User will be set automatically via auth state listener
        }}
      />
    </div>
  );
}
